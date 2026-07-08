"""Moteur de rapprochement bancaire — 100 % déterministe (aucun LLM).

Entrées : lignes de relevé bancaire + écritures comptables du compte de banque.
Sortie  : appariements avec score de confiance pondéré, lignes non rapprochées
          classées par type d'écart, doublons.

Convention de signe (trésorerie vue entreprise) :
  - Relevé  : montant_signe = credit - debit   (encaissement +, décaissement -)
  - Écriture (compte 521, actif) : montant_signe = debit - credit
Un même mouvement doit avoir le MÊME signe des deux côtés.

Aucune source d'aléa : résultat reproductible à l'identique (→ champ algoVersion).
"""
from __future__ import annotations

import unicodedata
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal

from rapidfuzz import fuzz

ALGO_VERSION = "recon-1.0.0"

# Pondérations du score global. Le montant est le signal fort ; le libellé, faible.
POIDS_MONTANT = 0.55
POIDS_DATE = 0.20
POIDS_LIBELLE = 0.25

# Gate montant : une paire n'est candidate que si les montants concordent.
TOLERANCE_MONTANT = Decimal("1")   # écart absolu toléré (arrondis), en XAF
SCORE_MONTANT_MIN = 0.98           # sous ce seuil, pas de candidat

# Fenêtre de date : décalage date d'opération / date de valeur (jours).
FENETRE_JOURS = 5

# Seuil de confiance "fort". N'écarte JAMAIS une paire (le montant exact + la
# date dans la fenêtre suffisent à en faire un candidat) : sert uniquement à
# hiérarchiser la revue humaine côté UI. Aucun match n'est validé sans humain.
SEUIL_CONFIANCE_FORT = 0.75

MOTS_FRAIS = (
    "frais", "agios", "commission", "tenue de compte", "cotisation",
    "abonnement", "sms banking", "tva/comm", "com.", "interets debiteurs",
)
MOTS_CHEQUE = ("cheque", "chq", "cheq")


@dataclass(frozen=True)
class BankLine:
    id: str
    date_operation: date
    libelle: str
    debit: Decimal
    credit: Decimal
    reference: str | None = None

    @property
    def montant_signe(self) -> Decimal:
        return self.credit - self.debit


@dataclass(frozen=True)
class LedgerEntry:
    id: str
    date_ecriture: date
    libelle: str
    debit: Decimal
    credit: Decimal
    piece: str | None = None

    @property
    def montant_signe(self) -> Decimal:
        return self.debit - self.credit


@dataclass
class Match:
    ligne_releve_id: str
    ecriture_id: str
    score_confiance: float
    score_montant: float
    score_date: float
    score_libelle: float


@dataclass
class Ecart:
    """Ligne non rapprochée + classification déterministe."""

    cote: str  # "RELEVE" | "ECRITURE"
    ref_id: str
    montant_signe: Decimal
    libelle: str
    type_ecart: str  # valeurs de l'enum TypeEcart


@dataclass
class ReconciliationResult:
    matches: list[Match] = field(default_factory=list)
    ecarts: list[Ecart] = field(default_factory=list)
    algo_version: str = ALGO_VERSION


# ─────────────── Scores unitaires ───────────────
def _normalise(s: str) -> str:
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return " ".join(s.lower().split())


def score_montant(a: Decimal, b: Decimal) -> float:
    if (a > 0) != (b > 0) and a != 0 and b != 0:
        return 0.0  # sens opposés → pas le même mouvement
    diff = abs(a - b)
    if diff <= TOLERANCE_MONTANT:
        return 1.0
    ref = max(abs(a), abs(b))
    if ref == 0:
        return 0.0
    return max(0.0, 1.0 - float(diff / ref))


def score_date(a: date, b: date) -> float:
    jours = abs((a - b).days)
    if jours >= FENETRE_JOURS:
        return 0.0
    return 1.0 - jours / FENETRE_JOURS


def score_libelle(a: str, b: str) -> float:
    return fuzz.token_set_ratio(_normalise(a), _normalise(b)) / 100.0


def score_global(bl: BankLine, le: LedgerEntry) -> tuple[float, float, float, float]:
    sm = score_montant(bl.montant_signe, le.montant_signe)
    sd = score_date(bl.date_operation, le.date_ecriture)
    sl = score_libelle(bl.libelle, le.libelle)
    total = POIDS_MONTANT * sm + POIDS_DATE * sd + POIDS_LIBELLE * sl
    return total, sm, sd, sl


# ─────────────── Classification des écarts ───────────────
def _classer_releve(bl: BankLine) -> str:
    lib = _normalise(bl.libelle)
    if bl.montant_signe < 0 and any(m in lib for m in MOTS_FRAIS):
        return "FRAIS_BANCAIRE"
    if bl.montant_signe > 0:
        return "VIREMENT_NON_COMPTABILISE"  # encaissement au relevé, absent des comptes
    return "AUTRE"


def _classer_ecriture(le: LedgerEntry) -> str:
    lib = _normalise(le.libelle)
    ref = _normalise(le.piece or "")
    if le.montant_signe < 0 and (
        any(m in lib for m in MOTS_CHEQUE) or any(m in ref for m in MOTS_CHEQUE)
    ):
        return "CHEQUE_NON_DEBITE"  # chèque émis (comptabilisé) pas encore débité
    return "AUTRE"


def _detecter_doublons(lignes: list[BankLine]) -> set[str]:
    """Lignes de relevé strictement identiques (date + montant + libellé)."""
    vus: dict[tuple, str] = {}
    doublons: set[str] = set()
    for bl in lignes:
        cle = (bl.date_operation, bl.montant_signe, _normalise(bl.libelle))
        if cle in vus:
            doublons.add(bl.id)
        else:
            vus[cle] = bl.id
    return doublons


# ─────────────── Appariement global ───────────────
def rapprocher(
    lignes: list[BankLine],
    ecritures: list[LedgerEntry],
) -> ReconciliationResult:
    """Apparie relevé et écritures, un-à-un, par score décroissant (glouton).

    Une paire est candidate dès que le montant concorde (gate) et que la date
    tombe dans la fenêtre. Déterministe : tri stable, départage sur les ids.
    """
    result = ReconciliationResult()

    # 1) Doublons de relevé signalés d'emblée (exclus de l'appariement).
    doublons = _detecter_doublons(lignes)
    for bl in lignes:
        if bl.id in doublons:
            result.ecarts.append(
                Ecart("RELEVE", bl.id, bl.montant_signe, bl.libelle, "DOUBLON")
            )
    lignes = [bl for bl in lignes if bl.id not in doublons]

    # 2) Génère les paires candidates (gate montant obligatoire).
    candidats: list[tuple[float, float, float, float, str, str]] = []
    for bl in lignes:
        for le in ecritures:
            total, sm, sd, sl = score_global(bl, le)
            # Gate : montant concordant + date dans la fenêtre (sd > 0).
            if sm >= SCORE_MONTANT_MIN and sd > 0:
                candidats.append((total, sm, sd, sl, bl.id, le.id))

    # Tri déterministe : score desc, puis ids pour départager les ex-æquo.
    candidats.sort(key=lambda c: (-c[0], c[4], c[5]))

    pris_releve: set[str] = set()
    pris_ecriture: set[str] = set()
    for total, sm, sd, sl, bl_id, le_id in candidats:
        if bl_id in pris_releve or le_id in pris_ecriture:
            continue
        pris_releve.add(bl_id)
        pris_ecriture.add(le_id)
        result.matches.append(
            Match(bl_id, le_id, round(total, 4), round(sm, 4), round(sd, 4), round(sl, 4))
        )

    # 3) Restes → écarts classés.
    for bl in lignes:
        if bl.id not in pris_releve:
            result.ecarts.append(
                Ecart("RELEVE", bl.id, bl.montant_signe, bl.libelle, _classer_releve(bl))
            )
    for le in ecritures:
        if le.id not in pris_ecriture:
            result.ecarts.append(
                Ecart("ECRITURE", le.id, le.montant_signe, le.libelle, _classer_ecriture(le))
            )

    return result
