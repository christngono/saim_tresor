"""Endpoints du module Analyse de facturation / DSO.

Flux : upload → extraction IA (isolée) → analyse déterministe (anomalies, DSO) →
génération de relances (brouillons) → validation humaine avant envoi.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.audit.logger import log
from app.core.invoicing.anomalies import FactureData, detecter
from app.core.invoicing.dso import calculer_dso
from app.core.invoicing.relance import generer_relances
from app.db.prisma import tenant_scope
from app.llm.extraction.invoice import extraire_facture
from app.routers.reconciliation import Ctx, get_ctx
from app.schemas.invoicing import AnalyseInput, ValiderRelance
from app.services import storage

router = APIRouter(prefix="/invoicing", tags=["facturation"])


async def _charger_factures(tx, entreprise_id: str) -> tuple[list, list[FactureData]]:
    rows = await tx.facture.find_many(where={"entrepriseId": entreprise_id})
    data = [
        FactureData(
            f.id, f.sens, f.numero, f.tiers, f.dateEmission.date(), f.dateEcheance.date(),
            f.montantHT, f.montantTVA, f.montantTTC, f.montantPaye,
        )
        for f in rows
    ]
    return rows, data


@router.post("/upload")
async def upload_facture(
    fichier: UploadFile = File(...),
    ctx: Ctx = Depends(get_ctx),
):
    contenu = await fichier.read()
    key = f"{ctx.entreprise_id}/factures/{uuid.uuid4()}-{fichier.filename}"
    storage.put_object(key, contenu, fichier.content_type or "application/octet-stream")
    texte = contenu.decode("utf-8", "ignore") if (fichier.filename or "").endswith(".txt") else None
    extrait = await extraire_facture(contenu, fichier.content_type or "", texte)

    async with tenant_scope(ctx.entreprise_id) as tx:
        doc = await tx.documentimporte.create(data={
            "entrepriseId": ctx.entreprise_id, "r2Key": key,
            "nomOriginal": fichier.filename or "facture", "typeMime": fichier.content_type or "",
            "taille": len(contenu), "categorie": "FACTURE", "uploadeParId": ctx.utilisateur_id,
        })
        f = await tx.facture.create(data={
            "entrepriseId": ctx.entreprise_id, "sens": extrait.sens, "numero": extrait.numero,
            "tiers": extrait.tiers,
            "dateEmission": datetime.combine(extrait.date_emission, datetime.min.time()),
            "dateEcheance": datetime.combine(extrait.date_echeance, datetime.min.time()),
            "montantHT": extrait.montant_ht, "montantTVA": extrait.montant_tva,
            "montantTTC": extrait.montant_ttc, "documentId": doc.id,
            "source": "IA_EXTRACTION", "confianceExtraction": extrait.confiance,
        })
        await log(tx, entreprise_id=ctx.entreprise_id, acteur="IA",
                  modele_ia=extrait.modele_utilise, action="EXTRAIRE_FACTURE",
                  entite="factures", entite_id=f.id, apres={"numero": extrait.numero})
    return {"facture_id": f.id, "numero": extrait.numero, "modele": extrait.modele_utilise}


@router.get("/factures")
async def lister_factures(ctx: Ctx = Depends(get_ctx)):
    async with tenant_scope(ctx.entreprise_id) as tx:
        rows = await tx.facture.find_many(
            where={"entrepriseId": ctx.entreprise_id}, order={"dateEcheance": "asc"})
        return [{
            "id": f.id, "sens": f.sens, "numero": f.numero, "tiers": f.tiers,
            "dateEcheance": f.dateEcheance.date().isoformat(),
            "montantTTC": str(f.montantTTC), "montantPaye": str(f.montantPaye),
            "resteAPayer": str(f.montantTTC - f.montantPaye), "statut": f.statut,
        } for f in rows]


@router.post("/analyse")
async def analyser(payload: AnalyseInput, ctx: Ctx = Depends(get_ctx)):
    async with tenant_scope(ctx.entreprise_id) as tx:
        _, data = await _charger_factures(tx, ctx.entreprise_id)
        anomalies = detecter(data, payload.date_reference)

        # Recalcul complet : on repart d'un état propre (déterministe).
        await tx.anomaliefacture.delete_many(
            where={"facture": {"is": {"entrepriseId": ctx.entreprise_id}}})
        for a in anomalies:
            await tx.anomaliefacture.create(data={
                "factureId": a.facture_id, "type": a.type, "detail": a.detail})

        dso = calculer_dso(data, payload.date_reference, payload.periode_jours)
        await log(tx, entreprise_id=ctx.entreprise_id, acteur="IA",
                  modele_ia="deterministe/anomalies-1.0.0", action="ANALYSER_FACTURES",
                  entite="factures", entite_id="*",
                  apres={"nb_anomalies": len(anomalies), "dso": dso["dso_jours"]})
        return {
            "dso": dso,
            "anomalies": [{"facture_id": a.facture_id, "type": a.type, "detail": a.detail}
                          for a in anomalies],
        }


@router.get("/dso")
async def dso(date_reference: date, periode_jours: int = 90, ctx: Ctx = Depends(get_ctx)):
    async with tenant_scope(ctx.entreprise_id) as tx:
        _, data = await _charger_factures(tx, ctx.entreprise_id)
        return calculer_dso(data, date_reference, periode_jours)


@router.post("/relances/generer")
async def generer(payload: AnalyseInput, ctx: Ctx = Depends(get_ctx)):
    async with tenant_scope(ctx.entreprise_id) as tx:
        _, data = await _charger_factures(tx, ctx.entreprise_id)
        brouillons = generer_relances(data, payload.date_reference)
        crees = []
        for b in brouillons:
            r = await tx.relance.create(data={
                "factureId": b.facture_id, "niveau": b.niveau,
                "canal": b.canal, "statut": "BROUILLON"})
            crees.append({"id": r.id, "facture_id": b.facture_id, "tiers": b.tiers,
                          "niveau": b.niveau, "jours_retard": b.jours_retard,
                          "montant_du": str(b.montant_du), "message": b.message,
                          "statut": "BROUILLON"})
        await log(tx, entreprise_id=ctx.entreprise_id, acteur="IA",
                  modele_ia="deterministe/relance-1.0.0", action="GENERER_RELANCES",
                  entite="relances", entite_id="*", apres={"nb": len(crees)})
        return {"relances": crees}


@router.post("/relances/valider")
async def valider_relance(payload: ValiderRelance, ctx: Ctx = Depends(get_ctx)):
    """Validation humaine : envoi effectif ou annulation d'une relance."""
    async with tenant_scope(ctx.entreprise_id) as tx:
        r = await tx.relance.find_unique(where={"id": payload.relance_id})
        if r is None:
            raise HTTPException(404, "Relance introuvable")
        if payload.decision == "ENVOYER":
            data = {"statut": "ENVOYEE", "envoyeeLe": datetime.utcnow()}
        else:
            data = {"statut": "ANNULEE"}
        await tx.relance.update(where={"id": payload.relance_id}, data=data)
        await log(tx, entreprise_id=ctx.entreprise_id, acteur="HUMAIN",
                  utilisateur_id=ctx.utilisateur_id, action="VALIDER_RELANCE",
                  entite="relances", entite_id=payload.relance_id,
                  avant={"statut": r.statut}, apres=data)
        return {"id": payload.relance_id, "statut": data["statut"]}
