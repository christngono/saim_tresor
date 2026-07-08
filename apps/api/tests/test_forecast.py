"""Tests du prévisionnel de trésorerie — déterministe."""
import csv
from datetime import date
from decimal import Decimal
from pathlib import Path

from app.core.cashflow.forecast import FactureEnCours, projeter

F = Path(__file__).resolve().parents[3] / "fixtures"


def _factures() -> list[FactureEnCours]:
    out = []
    with open(F / "factures.csv") as f:
        for r in csv.DictReader(f):
            reste = Decimal(r["montant_ttc"]) - Decimal(r["montant_paye"])
            out.append(FactureEnCours(r["sens"], date.fromisoformat(r["date_echeance"]), reste))
    return out


def test_rupture_detectee_a_30j():
    res = projeter(Decimal("4400000"), _factures(), date(2026, 6, 30))
    assert res["alerte_rupture"] is True
    assert res["rupture_horizon_jours"] == 30
    p30 = res["points"][0]
    assert p30["encaissements_prevus"] == "1500000"
    assert p30["decaissements_prevus"] == "6000000"
    assert p30["solde_projete"] == "-100000"  # rupture
    assert p30["rupture"] is True


def test_horizons_cumulatifs():
    res = projeter(Decimal("4400000"), _factures(), date(2026, 6, 30))
    p60, p90 = res["points"][1], res["points"][2]
    assert p60["solde_projete"] == "400000"
    assert p90["solde_projete"] == "900000"


def test_pas_de_rupture_si_tresorerie_suffisante():
    res = projeter(Decimal("50000000"), _factures(), date(2026, 6, 30))
    assert res["alerte_rupture"] is False
