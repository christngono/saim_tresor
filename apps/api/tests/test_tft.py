"""Tests du moteur TFT — déterministe, sans DB ni LLM.

Vérifient l'invariant de réconciliation (FTAO+FTAI+FTAF == variation == Δ classe 5)
et la conformité des postes au jeu de test (fixtures/balance_comptable.csv).
"""
import csv
from decimal import Decimal
from pathlib import Path

from app.core.cashflow.tft import MouvementCompte, construire_tft

F = Path(__file__).resolve().parents[3] / "fixtures"


def _mouvements() -> list[MouvementCompte]:
    out = []
    with open(F / "balance_comptable.csv") as f:
        for r in csv.DictReader(f):
            delta = Decimal(r["mouvement_debit"]) - Decimal(r["mouvement_credit"])
            out.append(MouvementCompte(r["numero"], delta))
    return out


def test_livres_equilibres():
    # Double-entrée : somme des deltas nulle.
    assert sum((m.delta for m in _mouvements()), Decimal(0)) == 0


def test_tft_reconcilie():
    tft = construire_tft(_mouvements(), Decimal("3700000"), "INDIRECTE")
    assert tft["controle"] == "0"
    assert tft["equilibre"] is True
    ftao = Decimal(tft["flux_operationnel"]["total"])
    ftai = Decimal(tft["flux_investissement"]["total"])
    ftaf = Decimal(tft["flux_financement"]["total"])
    assert ftao + ftai + ftaf == Decimal(tft["variation_tresorerie"])


def test_postes_attendus():
    tft = construire_tft(_mouvements(), Decimal("3700000"), "INDIRECTE")
    assert tft["flux_operationnel"]["resultat_net"] == "2600000"
    assert tft["flux_operationnel"]["dotations_amortissements_provisions"] == "400000"
    assert tft["flux_operationnel"]["variation_bfr"] == "-800000"
    assert tft["flux_operationnel"]["total"] == "2200000"
    assert tft["flux_investissement"]["total"] == "-1000000"
    assert tft["flux_financement"]["total"] == "-500000"
    assert tft["variation_tresorerie"] == "700000"
    assert tft["tresorerie_cloture"] == "4400000"


def test_methode_directe_coherente():
    tft = construire_tft(_mouvements(), Decimal("3700000"), "DIRECTE")
    assert tft["flux_operationnel_direct"]["coherent_avec_indirect"] is True
