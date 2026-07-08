"""Endpoints du module Tableaux de flux de trésorerie (TFT).

Flux : construction déterministe du TFT (SYSCOHADA) → prévisionnel glissant →
validation humaine → export. Aucun LLM dans le calcul.
"""
from __future__ import annotations

import io
from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from prisma import Json

from app.audit.logger import log
from app.core.cashflow.forecast import FactureEnCours, projeter
from app.core.cashflow.tft import MouvementCompte, construire_tft
from app.db.prisma import tenant_scope
from app.routers.reconciliation import Ctx, get_ctx
from app.schemas.cashflow import ConstruireTFT, ProjeterTresorerie, TFTOut
from app.services import storage

router = APIRouter(prefix="/cashflow", tags=["tft"])


@router.post("/build", response_model=TFTOut)
async def construire(payload: ConstruireTFT, ctx: Ctx = Depends(get_ctx)):
    debut = datetime.combine(payload.periode_debut, datetime.min.time())
    fin = datetime.combine(payload.periode_fin, datetime.max.time())

    async with tenant_scope(ctx.entreprise_id) as tx:
        ecritures = await tx.ecriturecomptable.find_many(
            where={"entrepriseId": ctx.entreprise_id,
                   "dateEcriture": {"gte": debut, "lte": fin}},
            include={"compte": True},
        )
        # Agrégation déterministe : delta = Σ débit − Σ crédit par compte.
        deltas: dict[str, Decimal] = {}
        for e in ecritures:
            numero = e.compte.numero
            deltas[numero] = deltas.get(numero, Decimal(0)) + (e.debit - e.credit)
        mouvements = [MouvementCompte(n, d) for n, d in deltas.items()]

        tft = construire_tft(mouvements, payload.tresorerie_ouverture, payload.methode)

        rec = await tx.tft.create(data={
            "entrepriseId": ctx.entreprise_id, "methode": payload.methode,
            "periodeDebut": debut, "periodeFin": fin,
            "donnees": Json(tft), "statut": "EN_REVUE", "algoVersion": tft["algo_version"],
        })
        await log(
            tx, entreprise_id=ctx.entreprise_id, acteur="IA",
            modele_ia=f"deterministe/{tft['algo_version']}", action="CONSTRUIRE_TFT",
            entite="tfts", entite_id=rec.id,
            apres={"variation": tft["variation_tresorerie"], "equilibre": tft["equilibre"]},
        )
        return TFTOut(id=rec.id, statut=rec.statut, methode=rec.methode,
                      algo_version=rec.algoVersion, donnees=tft)


@router.post("/forecast")
async def forecast(payload: ProjeterTresorerie, ctx: Ctx = Depends(get_ctx)):
    async with tenant_scope(ctx.entreprise_id) as tx:
        factures = await tx.facture.find_many(
            where={"entrepriseId": ctx.entreprise_id, "statut": {"not": "PAYEE"}}
        )
        en_cours = [
            FactureEnCours(f.sens, f.dateEcheance.date(), f.montantTTC - f.montantPaye)
            for f in factures if (f.montantTTC - f.montantPaye) > 0
        ]
        return projeter(
            payload.solde_initial, en_cours, payload.date_reference, payload.seuil_alerte
        )


@router.get("/{tft_id}", response_model=TFTOut)
async def lire(tft_id: str, ctx: Ctx = Depends(get_ctx)):
    async with tenant_scope(ctx.entreprise_id) as tx:
        rec = await tx.tft.find_unique(where={"id": tft_id})
        if rec is None:
            raise HTTPException(404, "TFT introuvable")
        return TFTOut(id=rec.id, statut=rec.statut, methode=rec.methode,
                      algo_version=rec.algoVersion, donnees=rec.donnees,
                      previsionnel=rec.previsionnel)


@router.post("/{tft_id}/valider")
async def valider(tft_id: str, ctx: Ctx = Depends(get_ctx)):
    async with tenant_scope(ctx.entreprise_id) as tx:
        await tx.tft.update(
            where={"id": tft_id},
            data={"statut": "VALIDE", "valideParId": ctx.utilisateur_id,
                  "valideLe": datetime.utcnow()},
        )
        await log(tx, entreprise_id=ctx.entreprise_id, acteur="HUMAIN",
                  utilisateur_id=ctx.utilisateur_id, action="VALIDER_TFT",
                  entite="tfts", entite_id=tft_id, apres={"statut": "VALIDE"})
        return {"id": tft_id, "statut": "VALIDE"}


@router.post("/{tft_id}/export")
async def exporter(tft_id: str, ctx: Ctx = Depends(get_ctx)):
    async with tenant_scope(ctx.entreprise_id) as tx:
        rec = await tx.tft.find_unique(where={"id": tft_id})
        if rec is None:
            raise HTTPException(404, "TFT introuvable")
        if rec.statut not in ("VALIDE", "EXPORTE"):
            raise HTTPException(409, "Validation humaine requise avant export")
        contenu = _tft_vers_xlsx(rec.donnees)
        key = f"{ctx.entreprise_id}/exports/tft-{tft_id}.xlsx"
        storage.put_object(
            key, contenu,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        await tx.tft.update(where={"id": tft_id}, data={"statut": "EXPORTE"})
        await log(tx, entreprise_id=ctx.entreprise_id, acteur="HUMAIN",
                  utilisateur_id=ctx.utilisateur_id, action="EXPORTER_TFT",
                  entite="tfts", entite_id=tft_id, apres={"r2Key": key})
        return {"url": storage.presigned_url(key), "statut": "EXPORTE"}


def _tft_vers_xlsx(d: dict) -> bytes:
    from openpyxl import Workbook

    wb = Workbook()
    ws = wb.active
    ws.title = "TFT"
    ws.append([f"Tableau des flux de trésorerie — {d['norme']} ({d['methode']})"])
    ws.append([])
    op = d["flux_operationnel"]
    ws.append(["FTAO — Flux opérationnels", op["total"]])
    ws.append(["  Résultat net", op["resultat_net"]])
    ws.append(["  Dotations amort./prov.", op["dotations_amortissements_provisions"]])
    ws.append(["  Variation du BFR", op["variation_bfr"]])
    ws.append(["FTAI — Flux d'investissement", d["flux_investissement"]["total"]])
    ws.append(["FTAF — Flux de financement", d["flux_financement"]["total"]])
    ws.append(["Variation de trésorerie", d["variation_tresorerie"]])
    ws.append(["Trésorerie d'ouverture", d["tresorerie_ouverture"]])
    ws.append(["Trésorerie de clôture", d["tresorerie_cloture"]])
    ws.append(["Contrôle (=0)", d["controle"]])
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()
