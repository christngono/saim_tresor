"""Tests du module Analyse de facturation / DSO — déterministe, sans DB ni LLM."""
import csv
from collections import Counter
from datetime import date
from decimal import Decimal
from pathlib import Path

from app.core.invoicing.anomalies import FactureData, detecter
from app.core.invoicing.dso import calculer_dso
from app.core.invoicing.relance import generer_relances

F = Path(__file__).resolve().parents[3] / "fixtures"
REF = date(2026, 7, 8)


def _factures() -> list[FactureData]:
    out = []
    with open(F / "factures_analyse.csv") as f:
        for i, r in enumerate(csv.DictReader(f)):
            out.append(FactureData(
                f"f{i}", r["sens"], r["numero"], r["tiers"],
                date.fromisoformat(r["date_emission"]), date.fromisoformat(r["date_echeance"]),
                Decimal(r["montant_ht"]), Decimal(r["montant_tva"]),
                Decimal(r["montant_ttc"]), Decimal(r["montant_paye"])))
    return out


def test_anomalies_par_type():
    anomalies = detecter(_factures(), REF)
    par_type = Counter(a.type for a in anomalies)
    assert par_type == Counter({
        "RETARD": 4, "DOUBLON": 1, "ECART_PRIX": 1, "MONTANT_INCOHERENT": 1})


def test_doublon_et_ecart_prix_sur_meme_facture():
    anomalies = detecter(_factures(), REF)
    doublon = next(a for a in anomalies if a.type == "DOUBLON")
    assert any(a.type == "ECART_PRIX" and a.facture_id == doublon.facture_id
               for a in anomalies)


def test_montant_incoherent_fournisseur():
    anomalies = detecter(_factures(), REF)
    inc = [a for a in anomalies if a.type == "MONTANT_INCOHERENT"]
    assert len(inc) == 1  # FA-2026-050 : 1 000 000 + 200 000 ≠ 1 250 000


def test_dso():
    dso = calculer_dso(_factures(), REF, 90)
    assert dso["encours_creances_ttc"] == "10300000"
    assert dso["chiffre_affaires_ttc"] == "13300000"
    assert dso["dso_jours"] == "69.7"


def test_relances_niveaux():
    relances = generer_relances(_factures(), REF)
    assert len(relances) == 4
    niveaux = Counter(r.niveau for r in relances)
    assert niveaux == Counter({1: 2, 2: 2})
    assert all(r.statut == "BROUILLON" for r in relances)  # jamais envoyé sans humain


def test_pas_de_relance_pour_facture_soldee():
    # FV-2026-013 est soldée → aucune relance.
    relances = generer_relances(_factures(), REF)
    assert all(r.tiers != "SIGMA SARL" for r in relances)
