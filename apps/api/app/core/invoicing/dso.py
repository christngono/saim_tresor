"""Calcul du DSO (Days Sales Outstanding) — déterministe.

DSO = (encours créances clients TTC / chiffre d'affaires TTC de la période)
      × nombre de jours de la période.
Indicateur du délai moyen de paiement des clients. Calcul reproductible.
"""
from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP

from .anomalies import FactureData

ALGO_VERSION = "dso-1.0.0"


def calculer_dso(
    factures: list[FactureData],
    date_reference: date,
    periode_jours: int = 90,
) -> dict:
    debut = date_reference - timedelta(days=periode_jours)
    clients = [f for f in factures if f.sens == "CLIENT"]

    encours = sum(
        (f.reste_a_payer for f in clients
         if f.date_emission <= date_reference and f.reste_a_payer > 0),
        Decimal("0"),
    )
    ca_ttc = sum(
        (f.montant_ttc for f in clients if debut <= f.date_emission <= date_reference),
        Decimal("0"),
    )

    if ca_ttc > 0:
        dso = (encours / ca_ttc * periode_jours).quantize(Decimal("0.1"), ROUND_HALF_UP)
    else:
        dso = Decimal("0")

    return {
        "algo_version": ALGO_VERSION,
        "date_reference": date_reference.isoformat(),
        "periode_jours": periode_jours,
        "encours_creances_ttc": str(encours),
        "chiffre_affaires_ttc": str(ca_ttc),
        "dso_jours": str(dso),
    }
