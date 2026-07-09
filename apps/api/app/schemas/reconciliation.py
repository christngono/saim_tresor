"""Schémas Pydantic — I/O API + validation stricte des extractions IA.

L'extraction LLM DOIT produire un JSON conforme à `ReleveExtrait`. Toute donnée
hors schéma est rejetée : le LLM ne fait qu'extraire, il ne calcule rien.
"""
from datetime import date
from decimal import Decimal

from pydantic import BaseModel, Field


# ── Sortie d'extraction (remplie par le LLM, puis validée) ──
class LigneExtraite(BaseModel):
    date_operation: date
    date_valeur: date | None = None
    libelle: str
    reference: str | None = None
    debit: Decimal | None = None
    credit: Decimal | None = None
    confiance: float = Field(ge=0, le=1, default=0.0)


class ReleveExtrait(BaseModel):
    banque: str | None = None
    numero_compte: str | None = None
    periode_debut: date
    periode_fin: date
    solde_initial: Decimal
    solde_final: Decimal
    lignes: list[LigneExtraite]
    modele_utilise: str  # "qwen2.5-vl" ou fallback "groq/..."


# ── I/O des endpoints ──
class LancerRapprochement(BaseModel):
    compte_bancaire_id: str
    releve_id: str
    periode_debut: date
    periode_fin: date


class ValiderMatch(BaseModel):
    match_id: str
    decision: str = Field(pattern="^(VALIDE|REJETE|CORRIGE)$")
    ecriture_id_corrigee: str | None = None  # si CORRIGE : réappariement manuel


class LigneReleveOut(BaseModel):
    date_operation: date
    date_valeur: date | None = None
    libelle: str
    reference: str | None = None
    montant: Decimal  # signé, vue trésorerie (crédit − débit)
    sens: str  # ENTREE | SORTIE


class EcritureOut(BaseModel):
    date_ecriture: date
    journal: str
    piece: str | None = None
    libelle: str
    montant: Decimal  # signé (débit − crédit)
    sens: str


class MatchOut(BaseModel):
    id: str
    ligne_releve_id: str | None
    ecriture_id: str | None
    score_confiance: float
    score_montant: float
    score_date: float
    score_libelle: float
    methode: str
    type_ecart: str | None
    statut: str
    # Enrichissements (dérivés à la lecture, aucune donnée nouvelle en base) :
    releve: LigneReleveOut | None = None
    ecriture: EcritureOut | None = None
    ecart_jours: int | None = None
    explication: str | None = None


class RapprochementOut(BaseModel):
    id: str
    statut: str
    solde_releve: Decimal
    solde_comptable: Decimal
    ecart: Decimal
    algo_version: str
    matches: list[MatchOut]
