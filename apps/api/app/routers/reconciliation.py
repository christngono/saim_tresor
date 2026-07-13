"""Endpoints du module Rapprochement bancaire.

Flux : upload → extraction (IA, isolée) → rapprochement (déterministe) →
résultats → validation humaine → export SYSCOHADA.

Aucun résultat n'est définitif sans validation humaine explicite : l'export est
bloqué tant que le rapprochement n'est pas au statut VALIDE.
"""
from __future__ import annotations

import csv
import io
import re
import uuid
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

from fastapi import (
    APIRouter, Depends, File, Form, Header, HTTPException, Response, UploadFile,
)

XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

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


# ── 1bis) Imports CSV déterministes (ni LLM, ni stockage R2) ──
def _dec(v: str | None) -> Decimal:
    """Tolère les formats FR : virgule décimale, espaces/insécables (milliers)."""
    s = (v or "").replace(" ", " ").strip()
    if not s:
        return Decimal("0")
    s = s.replace(" ", "")
    if "," in s and "." in s:      # '.' milliers, ',' décimale → '1.234.567,89'
        s = s.replace(".", "").replace(",", ".")
    elif "," in s:                  # ',' décimale → '1234,89'
        s = s.replace(",", ".")
    try:
        return Decimal(s)
    except InvalidOperation:
        raise HTTPException(400, f"Montant invalide : {v!r}")


def _date(v: str) -> datetime:
    """Accepte YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY."""
    s = (v or "").strip()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%d/%m/%y"):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    raise HTTPException(400, f"Date invalide : {v!r} (formats acceptés : AAAA-MM-JJ ou JJ/MM/AAAA)")


# Alias de colonnes → nom canonique (tolère les en-têtes réels des logiciels FR).
ALIASES = {
    "date_ecriture": ("date", "date ecriture", "date écriture", "date comptable"),
    "date_operation": ("date", "date operation", "date d'operation", "date d'opération"),
    "date_valeur": ("date valeur", "valeur"),
    "libelle": ("libellé", "intitule", "intitulé", "description", "designation", "désignation", "objet"),
    "debit": ("débit", "debits", "montant debit"),
    "credit": ("crédit", "credits", "montant credit"),
    "compte": ("n° compte", "no compte", "numero compte", "numéro de compte", "compte general"),
    "piece": ("pièce", "n° piece", "n° pièce", "num piece", "justificatif"),
    "reference": ("référence", "ref", "réf"),
    "journal": ("jal", "code journal"),
    "solde": ("solde progressif", "solde cumule", "solde cumulé", "solde courant"),
}


def _lire_csv(contenu: bytes, colonnes: set[str]) -> list[dict]:
    """Lit un CSV en détectant le séparateur (',', ';', tabulation), en
    normalisant les en-têtes (minuscules, sans espaces/BOM) et en appliquant les
    alias de colonnes usuels."""
    texte = contenu.decode("utf-8-sig")
    entete = next((l for l in texte.splitlines() if l.strip()), "")
    delim = max((",", ";", "\t"), key=entete.count) if entete else ","
    reader = csv.DictReader(io.StringIO(texte), delimiter=delim)

    # alias -> canonique (pour les colonnes attendues seulement)
    alias_vers_canon = {a: canon for canon, al in ALIASES.items() if canon in colonnes for a in al}

    def canon(k: str) -> str:
        k = (k or "").strip().lower()
        return alias_vers_canon.get(k, k)

    champs = {canon(f) for f in (reader.fieldnames or [])}
    manquantes = colonnes - champs
    if manquantes:
        raise HTTPException(
            400,
            f"Colonnes manquantes : {sorted(manquantes)}. "
            f"Colonnes trouvées : {sorted((f or '').strip().lower() for f in (reader.fieldnames or []))} "
            f"(séparateur détecté : {delim!r}).",
        )
    rows = [{canon(k): (v or "").strip() for k, v in r.items()} for r in reader]
    return [r for r in rows if any(r.values())]  # ignore les lignes vides


@router.post("/grand-livre/import")
async def importer_grand_livre(
    fichier: UploadFile = File(...),
    ctx: Ctx = Depends(get_ctx),
):
    """Importe un grand livre depuis un CSV (crée comptes + écritures).

    Colonnes requises : date, compte, libelle, debit, credit (alias tolérés).
    Colonnes optionnelles : journal, piece, solde. Une ligne « à nouveau »
    (solde d'ouverture sans débit/crédit) est convertie en écriture d'ouverture.
    """
    rows = _lire_csv(
        await fichier.read(),
        {"date_ecriture", "compte", "libelle", "debit", "credit"},
    )
    async with tenant_scope(ctx.entreprise_id) as tx:
        cache: dict[str, str] = {}
        importees = 0
        for i, r in enumerate(rows):
            # Extrait le numéro de compte (ex "5211 - Banque locale" → "5211").
            m = re.match(r"\s*(\d+)", r["compte"])
            if not m:
                continue
            numero = m.group(1)
            debit, credit = _dec(r.get("debit")), _dec(r.get("credit"))

            # Solde d'ouverture (« à nouveau ») → écriture d'ouverture depuis le solde.
            lib_norm = r["libelle"].lower()
            is_ouverture = (
                debit == 0 and credit == 0 and r.get("solde")
                and (i == 0 or "nouveau" in lib_norm or "report" in lib_norm)
            )
            if is_ouverture:
                s = _dec(r["solde"])
                debit, credit = (s, Decimal(0)) if s >= 0 else (Decimal(0), -s)

            if numero not in cache:
                cc = await tx.comptecomptable.find_first(
                    where={"entrepriseId": ctx.entreprise_id, "numero": numero})
                if cc is None:
                    cc = await tx.comptecomptable.create(data={
                        "entrepriseId": ctx.entreprise_id, "numero": numero,
                        "intitule": f"Compte {numero}", "classe": int(numero[0])})
                cache[numero] = cc.id
            await tx.ecriturecomptable.create(data={
                "entrepriseId": ctx.entreprise_id, "compteId": cache[numero],
                "dateEcriture": _date(r["date_ecriture"]),
                "journal": r.get("journal") or "OD", "piece": (r.get("piece") or None),
                "libelle": r["libelle"], "debit": debit, "credit": credit,
                "source": "IMPORT_CSV"})
            importees += 1
        if importees == 0:
            raise HTTPException(400, "Aucune écriture valide dans le fichier.")
        await log(tx, entreprise_id=ctx.entreprise_id, acteur="HUMAIN",
                  utilisateur_id=ctx.utilisateur_id, action="IMPORTER_GRAND_LIVRE",
                  entite="ecritures_comptables", entite_id="*", apres={"nb": importees})
    return {"ecritures_importees": importees, "comptes": sorted(cache.keys())}


@router.post("/releve/import")
async def importer_releve(
    compte_bancaire_id: str = Form(...),
    solde_initial: str = Form(...),
    solde_final: str = Form(...),
    fichier: UploadFile = File(...),
    ctx: Ctx = Depends(get_ctx),
):
    """Importe un relevé bancaire depuis un CSV (crée le relevé + ses lignes).

    Colonnes : date_operation, date_valeur, libelle, reference, debit, credit.
    La période est déduite des dates d'opération.
    """
    rows = _lire_csv(
        await fichier.read(),
        {"date_operation", "libelle", "debit", "credit"},
    )
    if not rows:
        raise HTTPException(400, "Relevé vide")
    dates = [_date(r["date_operation"]).date() for r in rows]
    async with tenant_scope(ctx.entreprise_id) as tx:
        releve = await tx.relevebancaire.create(data={
            "entrepriseId": ctx.entreprise_id, "compteBancaireId": compte_bancaire_id,
            "periodeDebut": datetime.combine(min(dates), datetime.min.time()),
            "periodeFin": datetime.combine(max(dates), datetime.min.time()),
            "soldeInitial": _dec(solde_initial), "soldeFinal": _dec(solde_final),
            "source": "IMPORT_CSV", "statut": "VALIDE"})
        for r in rows:
            dv = r.get("date_valeur")
            await tx.lignereleve.create(data={
                "releveId": releve.id,
                "dateOperation": _date(r["date_operation"]),
                "dateValeur": _date(dv) if dv else None,
                "libelle": r["libelle"], "reference": (r.get("reference") or None),
                "debit": _dec(r["debit"]) or None, "credit": _dec(r["credit"]) or None})
        await log(tx, entreprise_id=ctx.entreprise_id, acteur="HUMAIN",
                  utilisateur_id=ctx.utilisateur_id, action="IMPORTER_RELEVE",
                  entite="releves_bancaires", entite_id=releve.id, apres={"nb_lignes": len(rows)})
    return {"releve_id": releve.id, "nb_lignes": len(rows),
            "periode_debut": min(dates).isoformat(), "periode_fin": max(dates).isoformat()}


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
        # Matching par PRÉFIXE : le compte 521 rapproche 521, 5211, 52110… etc.
        ecritures_db = await tx.ecriturecomptable.find_many(
            where={
                "entrepriseId": ctx.entreprise_id,
                "dateEcriture": {"gte": debut, "lte": fin},
                "compte": {"is": {"numero": {"startsWith": compte.compteSyscohada}}},
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
        contenu = _etat_vers_xlsx(etat)  # CPU pur, aucun appel réseau

        await tx.rapprochement.update(where={"id": rap_id}, data={"statut": "EXPORTE"})
        await log(
            tx, entreprise_id=ctx.entreprise_id, acteur="HUMAIN",
            utilisateur_id=ctx.utilisateur_id, action="EXPORTER_RAPPROCHEMENT",
            entite="rapprochements", entite_id=rap_id, apres={"statut": "EXPORTE"},
        )

    # Archivage HORS transaction (best-effort) : voir cashflow.exporter.
    try:
        storage.put_object(
            f"{ctx.entreprise_id}/exports/rapprochement-{rap_id}.xlsx", contenu, XLSX_MIME)
    except Exception:  # noqa: BLE001
        pass

    return Response(
        content=contenu, media_type=XLSX_MIME,
        headers={"Content-Disposition": f'attachment; filename="rapprochement-{rap_id}.xlsx"'},
    )


# ── Helpers ──
def _releve_out(l) -> dict | None:
    if l is None:
        return None
    montant = (l.credit or Decimal(0)) - (l.debit or Decimal(0))
    return {
        "date_operation": l.dateOperation.date(),
        "date_valeur": l.dateValeur.date() if l.dateValeur else None,
        "libelle": l.libelle, "reference": l.reference, "montant": montant,
        "sens": "ENTREE" if montant >= 0 else "SORTIE",
    }


def _ecriture_out(e) -> dict | None:
    if e is None:
        return None
    montant = e.debit - e.credit
    return {
        "date_ecriture": e.dateEcriture.date(), "journal": e.journal, "piece": e.piece,
        "libelle": e.libelle, "montant": montant,
        "sens": "ENTREE" if montant >= 0 else "SORTIE",
    }


def _explication(m, l, e) -> tuple[int | None, str | None]:
    """Phrase de critères dérivée des scores stockés + des 2 dates (immuables)."""
    if l is None or e is None:
        return None, None
    jours = abs((l.dateOperation.date() - e.dateEcriture.date()).days)
    parts = ["montant identique" if m.scoreMontant >= 0.98 else "montant différent"]
    parts.append("même date" if jours == 0 else f"écart {jours} j")
    if m.scoreLibelle >= 0.7:
        parts.append("libellé proche")
    elif m.scoreLibelle >= 0.4:
        parts.append("libellé partiel")
    else:
        parts.append("libellé différent")
    return jours, " · ".join(parts)


async def _to_out(tx, rap_id: str) -> RapprochementOut:
    rap = await tx.rapprochement.find_unique(where={"id": rap_id})
    if rap is None:
        raise HTTPException(404, "Rapprochement introuvable")
    matches = await tx.rapprochementmatch.find_many(
        where={"rapprochementId": rap_id},
        include={"ligneReleve": True, "ecriture": True},
    )
    out = []
    for m in matches:
        jours, expl = _explication(m, m.ligneReleve, m.ecriture)
        out.append({
            "id": m.id, "ligne_releve_id": m.ligneReleveId, "ecriture_id": m.ecritureId,
            "score_confiance": m.scoreConfiance, "score_montant": m.scoreMontant,
            "score_date": m.scoreDate, "score_libelle": m.scoreLibelle,
            "methode": m.methode, "type_ecart": m.typeEcart, "statut": m.statut,
            "releve": _releve_out(m.ligneReleve), "ecriture": _ecriture_out(m.ecriture),
            "ecart_jours": jours, "explication": expl,
        })
    return RapprochementOut(
        id=rap.id, statut=rap.statut, solde_releve=rap.soldeReleve,
        solde_comptable=rap.soldeComptable, ecart=rap.ecart, algo_version=rap.algoVersion,
        matches=out,
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
