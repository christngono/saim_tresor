"""Endpoints du module Rapprochement bancaire.

Flux : upload → extraction (IA, isolée) → rapprochement (déterministe) →
résultats → validation humaine → export SYSCOHADA.

Aucun résultat n'est définitif sans validation humaine explicite : l'export est
bloqué tant que le rapprochement n'est pas au statut VALIDE.
"""
from __future__ import annotations

import io
import uuid
from datetime import date, datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, UploadFile

from app.audit.logger import log
from app.core.reconciliation.matcher import BankLine, LedgerEntry, rapprocher
from app.core.reconciliation.report import construire_etat
from app.db.prisma import tenant_scope
from app.llm.extraction.bank_statement import extraire_releve
from app.schemas.reconciliation import (
    LancerRapprochement,
    RapprochementOut,
    ValiderMatch,
)
from app.services import storage

router = APIRouter(prefix="/reconciliation", tags=["rapprochement"])


# ── Contexte d'appel (tenant + utilisateur) ──
# En production : vérifier le JWT NextAuth v5 et en extraire ces valeurs.
class Ctx:
    def __init__(self, entreprise_id: str, utilisateur_id: str):
        self.entreprise_id = entreprise_id
        self.utilisateur_id = utilisateur_id


def get_ctx(
    x_entreprise_id: str = Header(...),
    x_utilisateur_id: str = Header(...),
) -> Ctx:
    return Ctx(x_entreprise_id, x_utilisateur_id)


# ── 1) Upload + extraction IA du relevé ──
@router.post("/upload")
async def upload_releve(
    compte_bancaire_id: str = Form(...),
    fichier: UploadFile = File(...),
    ctx: Ctx = Depends(get_ctx),
):
    contenu = await fichier.read()
    key = f"{ctx.entreprise_id}/releves/{uuid.uuid4()}-{fichier.filename}"
    storage.put_object(key, contenu, fichier.content_type or "application/octet-stream")

    texte_ocr = contenu.decode("utf-8", "ignore") if fichier.filename.endswith(".csv") else None
    extrait = await extraire_releve(contenu, fichier.content_type or "", texte_ocr)

    async with tenant_scope(ctx.entreprise_id) as tx:
        doc = await tx.documentimporte.create(
            data={
                "entrepriseId": ctx.entreprise_id,
                "r2Key": key,
                "nomOriginal": fichier.filename or "releve",
                "typeMime": fichier.content_type or "",
                "taille": len(contenu),
                "categorie": "RELEVE",
                "uploadeParId": ctx.utilisateur_id,
            }
        )
        releve = await tx.relevebancaire.create(
            data={
                "entrepriseId": ctx.entreprise_id,
                "compteBancaireId": compte_bancaire_id,
                "documentId": doc.id,
                "periodeDebut": datetime.combine(extrait.periode_debut, datetime.min.time()),
                "periodeFin": datetime.combine(extrait.periode_fin, datetime.min.time()),
                "soldeInitial": extrait.solde_initial,
                "soldeFinal": extrait.solde_final,
                "source": "IA_EXTRACTION",
                "statut": "EXTRAIT",
            }
        )
        for lg in extrait.lignes:
            await tx.lignereleve.create(
                data={
                    "releveId": releve.id,
                    "dateOperation": datetime.combine(lg.date_operation, datetime.min.time()),
                    "dateValeur": (
                        datetime.combine(lg.date_valeur, datetime.min.time())
                        if lg.date_valeur else None
                    ),
                    "libelle": lg.libelle,
                    "reference": lg.reference,
                    "debit": lg.debit,
                    "credit": lg.credit,
                    "confianceExtraction": lg.confiance,
                }
            )
        await log(
            tx, entreprise_id=ctx.entreprise_id, acteur="IA",
            modele_ia=extrait.modele_utilise, action="EXTRAIRE_RELEVE",
            entite="releves_bancaires", entite_id=releve.id,
            apres={"nb_lignes": len(extrait.lignes)},
        )

    return {"releve_id": releve.id, "nb_lignes": len(extrait.lignes),
            "modele": extrait.modele_utilise, "statut": "EXTRAIT",
            "periode_debut": extrait.periode_debut.isoformat(),
            "periode_fin": extrait.periode_fin.isoformat()}


# ── 2) Lancement du rapprochement (déterministe, aucun LLM) ──
@router.post("/run", response_model=RapprochementOut)
async def lancer(payload: LancerRapprochement, ctx: Ctx = Depends(get_ctx)):
    async with tenant_scope(ctx.entreprise_id) as tx:
        compte = await tx.comptebancaire.find_unique(where={"id": payload.compte_bancaire_id})
        if compte is None:
            raise HTTPException(404, "Compte bancaire introuvable")

        lignes_db = await tx.lignereleve.find_many(where={"releveId": payload.releve_id})
        releve = await tx.relevebancaire.find_unique(where={"id": payload.releve_id})

        debut = datetime.combine(payload.periode_debut, datetime.min.time())
        fin = datetime.combine(payload.periode_fin, datetime.max.time())
        ecritures_db = await tx.ecriturecomptable.find_many(
            where={
                "entrepriseId": ctx.entreprise_id,
                "dateEcriture": {"gte": debut, "lte": fin},
                "compte": {"is": {"numero": compte.compteSyscohada}},
            }
        )

        # Mapping DB → objets purs du matcher.
        lignes = [
            BankLine(l.id, l.dateOperation.date(), l.libelle,
                     l.debit or Decimal(0), l.credit or Decimal(0), l.reference)
            for l in lignes_db
        ]
        ecritures = [
            LedgerEntry(e.id, e.dateEcriture.date(), e.libelle, e.debit, e.credit, e.piece)
            for e in ecritures_db
        ]

        result = rapprocher(lignes, ecritures)

        solde_comptable = sum((e.debit - e.credit for e in ecritures_db), Decimal(0))
        solde_releve = releve.soldeFinal

        rap = await tx.rapprochement.create(
            data={
                "entrepriseId": ctx.entreprise_id,
                "compteBancaireId": payload.compte_bancaire_id,
                "periodeDebut": debut,
                "periodeFin": fin,
                "soldeReleve": solde_releve,
                "soldeComptable": solde_comptable,
                "ecart": solde_releve - solde_comptable,
                "statut": "EN_REVUE",
                "algoVersion": result.algo_version,
            }
        )
        for m in result.matches:
            await tx.rapprochementmatch.create(
                data={
                    "rapprochementId": rap.id, "ligneReleveId": m.ligne_releve_id,
                    "ecritureId": m.ecriture_id, "scoreConfiance": m.score_confiance,
                    "scoreMontant": m.score_montant, "scoreDate": m.score_date,
                    "scoreLibelle": m.score_libelle, "methode": "AUTO", "statut": "SUGGERE",
                }
            )
        for e in result.ecarts:
            await tx.rapprochementmatch.create(
                data={
                    "rapprochementId": rap.id,
                    "ligneReleveId": e.ref_id if e.cote == "RELEVE" else None,
                    "ecritureId": e.ref_id if e.cote == "ECRITURE" else None,
                    "scoreConfiance": 0.0, "scoreMontant": 0.0, "scoreDate": 0.0,
                    "scoreLibelle": 0.0, "methode": "AUTO", "typeEcart": e.type_ecart,
                    "statut": "SUGGERE",
                }
            )
        await log(
            tx, entreprise_id=ctx.entreprise_id, acteur="IA",
            modele_ia=f"deterministe/{result.algo_version}", action="LANCER_RAPPROCHEMENT",
            entite="rapprochements", entite_id=rap.id,
            apres={"nb_matches": len(result.matches), "nb_ecarts": len(result.ecarts)},
        )
        return await _to_out(tx, rap.id)


# ── 3) Résultats ──
@router.get("/{rap_id}", response_model=RapprochementOut)
async def resultats(rap_id: str, ctx: Ctx = Depends(get_ctx)):
    async with tenant_scope(ctx.entreprise_id) as tx:
        return await _to_out(tx, rap_id)


@router.get("/{rap_id}/etat")
async def etat_syscohada(rap_id: str, ctx: Ctx = Depends(get_ctx)):
    """État de rapprochement SYSCOHADA (recalculé à la volée, déterministe)."""
    async with tenant_scope(ctx.entreprise_id) as tx:
        rap = await tx.rapprochement.find_unique(where={"id": rap_id})
        if rap is None:
            raise HTTPException(404, "Rapprochement introuvable")
        matches = await tx.rapprochementmatch.find_many(where={"rapprochementId": rap_id})
        result = await _rebuild_result(tx, rap, matches)
        return construire_etat(result, rap.soldeComptable, rap.soldeReleve)


# ── 4) Validation humaine ──
@router.post("/match/valider")
async def valider_match(payload: ValiderMatch, ctx: Ctx = Depends(get_ctx)):
    async with tenant_scope(ctx.entreprise_id) as tx:
        match = await tx.rapprochementmatch.find_unique(where={"id": payload.match_id})
        if match is None:
            raise HTTPException(404, "Match introuvable")
        data = {"statut": payload.decision, "valideParId": ctx.utilisateur_id,
                "valideLe": datetime.utcnow(), "methode": "MANUEL"}
        if payload.decision == "CORRIGE" and payload.ecriture_id_corrigee:
            data["ecritureId"] = payload.ecriture_id_corrigee
        updated = await tx.rapprochementmatch.update(where={"id": payload.match_id}, data=data)
        await log(
            tx, entreprise_id=ctx.entreprise_id, acteur="HUMAIN",
            utilisateur_id=ctx.utilisateur_id, action="VALIDER_MATCH",
            entite="rapprochement_matches", entite_id=payload.match_id,
            avant={"statut": match.statut}, apres={"statut": payload.decision},
        )
        return {"id": updated.id, "statut": updated.statut}


@router.post("/{rap_id}/valider")
async def valider_rapprochement(rap_id: str, ctx: Ctx = Depends(get_ctx)):
    """Clôture humaine : passe le rapprochement en VALIDE (prérequis à l'export)."""
    async with tenant_scope(ctx.entreprise_id) as tx:
        restants = await tx.rapprochementmatch.count(
            where={"rapprochementId": rap_id, "statut": "SUGGERE"}
        )
        if restants > 0:
            raise HTTPException(400, f"{restants} élément(s) non revus par un humain")
        await tx.rapprochement.update(
            where={"id": rap_id},
            data={"statut": "VALIDE", "valideParId": ctx.utilisateur_id,
                  "valideLe": datetime.utcnow()},
        )
        await log(
            tx, entreprise_id=ctx.entreprise_id, acteur="HUMAIN",
            utilisateur_id=ctx.utilisateur_id, action="VALIDER_RAPPROCHEMENT",
            entite="rapprochements", entite_id=rap_id, apres={"statut": "VALIDE"},
        )
        return {"id": rap_id, "statut": "VALIDE"}


# ── 5) Export (bloqué tant que non validé) ──
@router.post("/{rap_id}/export")
async def exporter(rap_id: str, ctx: Ctx = Depends(get_ctx)):
    async with tenant_scope(ctx.entreprise_id) as tx:
        rap = await tx.rapprochement.find_unique(where={"id": rap_id})
        if rap is None:
            raise HTTPException(404, "Rapprochement introuvable")
        if rap.statut != "VALIDE":
            raise HTTPException(409, "Validation humaine requise avant export")

        matches = await tx.rapprochementmatch.find_many(where={"rapprochementId": rap_id})
        result = await _rebuild_result(tx, rap, matches)
        etat = construire_etat(result, rap.soldeComptable, rap.soldeReleve)
        contenu = _etat_vers_xlsx(etat)
        key = f"{ctx.entreprise_id}/exports/rapprochement-{rap_id}.xlsx"
        storage.put_object(
            key, contenu,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        await tx.rapprochement.update(where={"id": rap_id}, data={"statut": "EXPORTE"})
        await log(
            tx, entreprise_id=ctx.entreprise_id, acteur="HUMAIN",
            utilisateur_id=ctx.utilisateur_id, action="EXPORTER_RAPPROCHEMENT",
            entite="rapprochements", entite_id=rap_id, apres={"r2Key": key},
        )
        return {"url": storage.presigned_url(key), "statut": "EXPORTE"}


# ── Helpers ──
async def _to_out(tx, rap_id: str) -> RapprochementOut:
    rap = await tx.rapprochement.find_unique(where={"id": rap_id})
    if rap is None:
        raise HTTPException(404, "Rapprochement introuvable")
    matches = await tx.rapprochementmatch.find_many(where={"rapprochementId": rap_id})
    return RapprochementOut(
        id=rap.id, statut=rap.statut, solde_releve=rap.soldeReleve,
        solde_comptable=rap.soldeComptable, ecart=rap.ecart, algo_version=rap.algoVersion,
        matches=[
            {
                "id": m.id, "ligne_releve_id": m.ligneReleveId, "ecriture_id": m.ecritureId,
                "score_confiance": m.scoreConfiance, "score_montant": m.scoreMontant,
                "score_date": m.scoreDate, "score_libelle": m.scoreLibelle,
                "methode": m.methode, "type_ecart": m.typeEcart, "statut": m.statut,
            }
            for m in matches
        ],
    )


async def _rebuild_result(tx, rap, matches):
    """Reconstruit un ReconciliationResult à partir des matches persistés."""
    from app.core.reconciliation.matcher import Ecart, Match, ReconciliationResult

    res = ReconciliationResult(algo_version=rap.algoVersion)
    lignes = {l.id: l for l in await tx.lignereleve.find_many(
        where={"releve": {"is": {"compteBancaireId": rap.compteBancaireId}}})}
    ecrs = {e.id: e for e in await tx.ecriturecomptable.find_many(
        where={"entrepriseId": rap.entrepriseId})}
    for m in matches:
        if m.typeEcart:  # écart
            if m.ligneReleveId and m.ligneReleveId in lignes:
                l = lignes[m.ligneReleveId]
                res.ecarts.append(Ecart("RELEVE", l.id,
                    (l.credit or Decimal(0)) - (l.debit or Decimal(0)), l.libelle, m.typeEcart))
            elif m.ecritureId and m.ecritureId in ecrs:
                e = ecrs[m.ecritureId]
                res.ecarts.append(Ecart("ECRITURE", e.id, e.debit - e.credit, e.libelle, m.typeEcart))
        elif m.statut != "REJETE":
            res.matches.append(Match(m.ligneReleveId, m.ecritureId, m.scoreConfiance,
                                     m.scoreMontant, m.scoreDate, m.scoreLibelle))
    return res


def _etat_vers_xlsx(etat: dict) -> bytes:
    from openpyxl import Workbook

    wb = Workbook()
    ws = wb.active
    ws.title = "Rapprochement"
    ws.append([f"État de rapprochement — {etat['norme']}"])
    ws.append(["Moteur", etat["algo_version"], "Rapproché", "OUI" if etat["rapproche"] else "NON"])
    ws.append([])
    ws.append(["COMPTABILITÉ", "", "RELEVÉ", ""])
    ws.append(["Solde initial", etat["colonne_comptabilite"]["solde_initial"],
               "Solde initial", etat["colonne_releve"]["solde_initial"]])
    for a in etat["colonne_comptabilite"]["ajustements"]:
        ws.append([f"{a['type_ecart']} — {a['libelle']}", a["montant"]])
    for a in etat["colonne_releve"]["ajustements"]:
        ws.append(["", "", f"{a['type_ecart']} — {a['libelle']}", a["montant"]])
    ws.append(["Solde corrigé", etat["colonne_comptabilite"]["solde_corrige"],
               "Solde corrigé", etat["colonne_releve"]["solde_corrige"]])
    ws.append(["Résidu", etat["residu"]])
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()
