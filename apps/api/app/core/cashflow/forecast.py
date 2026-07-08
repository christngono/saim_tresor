"""Prévisionnel de trésorerie glissant 30/60/90 jours — déterministe.

À partir de la trésorerie courante et des factures en cours (créances clients à
encaisser, dettes fournisseurs à payer), projette le solde par horizon et
détecte un risque de rupture. Aucune décision automatique : c'est une alerte à
valider par le DAF.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal

ALGO_VERSION = "forecast-1.0.0"
HORIZONS = (30, 60, 90)


@dataclass(frozen=True)
class FactureEnCours:
    sens: str  # "CLIENT" (encaissement) | "FOURNISSEUR" (décaissement)
    date_echeance: date
    reste_a_payer: Decimal  # montantTTC − montantPaye


def projeter(
    solde_initial: Decimal,
    factures: list[FactureEnCours],
    date_reference: date,
    seuil_alerte: Decimal = Decimal("0"),
    horizons: tuple[int, ...] = HORIZONS,
) -> dict:
    points = []
    rupture_horizon: int | None = None

    for h in horizons:
        butoir = date_reference + timedelta(days=h)
        encaissements = sum(
            (f.reste_a_payer for f in factures
             if f.sens == "CLIENT" and date_reference < f.date_echeance <= butoir),
            Decimal("0"),
        )
        decaissements = sum(
            (f.reste_a_payer for f in factures
             if f.sens == "FOURNISSEUR" and date_reference < f.date_echeance <= butoir),
            Decimal("0"),
        )
        solde_projete = solde_initial + encaissements - decaissements
        rupture = solde_projete < seuil_alerte
        if rupture and rupture_horizon is None:
            rupture_horizon = h
        points.append({
            "horizon_jours": h,
            "date": butoir.isoformat(),
            "encaissements_prevus": str(encaissements),
            "decaissements_prevus": str(decaissements),
            "solde_projete": str(solde_projete),
            "rupture": rupture,
        })

    return {
        "algo_version": ALGO_VERSION,
        "date_reference": date_reference.isoformat(),
        "solde_initial": str(solde_initial),
        "seuil_alerte": str(seuil_alerte),
        "points": points,
        "alerte_rupture": rupture_horizon is not None,
        "rupture_horizon_jours": rupture_horizon,
    }
