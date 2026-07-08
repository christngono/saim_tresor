"""Schémas Pydantic — module TFT (I/O des endpoints)."""
from datetime import date
from decimal import Decimal

from pydantic import BaseModel, Field


class ConstruireTFT(BaseModel):
    periode_debut: date
    periode_fin: date
    tresorerie_ouverture: Decimal
    methode: str = Field(pattern="^(DIRECTE|INDIRECTE)$", default="INDIRECTE")


class ProjeterTresorerie(BaseModel):
    date_reference: date
    solde_initial: Decimal
    seuil_alerte: Decimal = Decimal("0")


class TFTOut(BaseModel):
    id: str
    statut: str
    methode: str
    algo_version: str
    donnees: dict
    previsionnel: dict | None = None
