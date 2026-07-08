"""Schémas Pydantic — module Analyse de facturation / DSO."""
from datetime import date
from decimal import Decimal

from pydantic import BaseModel, Field


# ── Sortie d'extraction (remplie par le LLM, puis validée) ──
class FactureExtraite(BaseModel):
    sens: str = Field(pattern="^(CLIENT|FOURNISSEUR)$")
    numero: str
    tiers: str
    date_emission: date
    date_echeance: date
    montant_ht: Decimal
    montant_tva: Decimal = Decimal("0")
    montant_ttc: Decimal
    confiance: float = Field(ge=0, le=1, default=0.0)
    modele_utilise: str


# ── I/O des endpoints ──
class AnalyseInput(BaseModel):
    date_reference: date
    periode_jours: int = 90


class AnomalieOut(BaseModel):
    facture_id: str
    type: str
    detail: str


class ValiderRelance(BaseModel):
    relance_id: str
    decision: str = Field(pattern="^(ENVOYER|ANNULER)$")
