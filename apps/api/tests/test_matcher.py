"""Tests du moteur de rapprochement — 100 % déterministe, sans DB ni LLM.

Ils documentent le comportement attendu sur les cas métier clés :
appariement exact, décalage de date de valeur, frais bancaires, chèque non
débité, doublon, et reproductibilité.
"""
from datetime import date
from decimal import Decimal

from app.core.reconciliation.matcher import (
    BankLine,
    LedgerEntry,
    rapprocher,
    score_montant,
)
from app.core.reconciliation.report import construire_etat


def _bl(id, d, lib, debit="0", credit="0", ref=None):
    return BankLine(id, date.fromisoformat(d), lib, Decimal(debit), Decimal(credit), ref)


def _le(id, d, lib, debit="0", credit="0", piece=None):
    return LedgerEntry(id, date.fromisoformat(d), lib, Decimal(debit), Decimal(credit), piece)


def test_sens_opposes_non_apparies():
    # Encaissement au relevé vs décaissement en compta : jamais le même mouvement.
    assert score_montant(Decimal("100"), Decimal("-100")) == 0.0


def test_appariement_exact():
    lignes = [_bl("b1", "2026-06-03", "VIR CLIENT ALPHA SARL", credit="1500000")]
    # Encaissement → compte banque débité.
    ecrs = [_le("e1", "2026-06-03", "Règlement ALPHA", debit="1500000")]
    res = rapprocher(lignes, ecrs)
    assert len(res.matches) == 1
    assert res.matches[0].score_confiance >= 0.75
    assert res.ecarts == []


def test_decalage_date_valeur_reste_apparie():
    lignes = [_bl("b1", "2026-06-05", "VIR FOURNISSEUR BETA", debit="800000")]
    ecrs = [_le("e1", "2026-06-02", "Paiement BETA", credit="800000")]  # 3 j d'écart
    res = rapprocher(lignes, ecrs)
    assert len(res.matches) == 1
    assert 0 < res.matches[0].score_date < 1  # pénalisé mais accepté


def test_frais_bancaires_classes():
    lignes = [_bl("b1", "2026-06-30", "FRAIS TENUE DE COMPTE", debit="15000")]
    res = rapprocher(lignes, [])
    assert len(res.ecarts) == 1
    assert res.ecarts[0].type_ecart == "FRAIS_BANCAIRE"


def test_cheque_non_debite_classe():
    ecrs = [_le("e1", "2026-06-28", "Chèque n°004512 GAMMA", credit="450000", piece="CHQ004512")]
    res = rapprocher([], ecrs)
    assert res.ecarts[0].type_ecart == "CHEQUE_NON_DEBITE"


def test_doublon_detecte():
    lignes = [
        _bl("b1", "2026-06-10", "VIR CLIENT DELTA", credit="300000"),
        _bl("b2", "2026-06-10", "VIR CLIENT DELTA", credit="300000"),
    ]
    res = rapprocher(lignes, [])
    assert any(e.type_ecart == "DOUBLON" for e in res.ecarts)


def test_reproductibilite():
    lignes = [_bl("b1", "2026-06-03", "VIR ALPHA", credit="1500000")]
    ecrs = [_le("e1", "2026-06-03", "ALPHA", debit="1500000")]
    r1 = rapprocher(lignes, ecrs)
    r2 = rapprocher(lignes, ecrs)
    assert r1.matches[0].score_confiance == r2.matches[0].score_confiance


def test_etat_syscohada_equilibre():
    # Frais non comptabilisés (relevé) + chèque non débité (compta).
    lignes = [_bl("b1", "2026-06-30", "FRAIS TENUE DE COMPTE", debit="15000")]
    ecrs = [_le("e1", "2026-06-28", "Chèque n°004512", credit="450000", piece="CHQ004512")]
    res = rapprocher(lignes, ecrs)
    # solde compta 1 000 000 ; solde relevé = 1 000 000 - 15 000 (frais) + 450 000 (chèque pas débité)
    etat = construire_etat(res, Decimal("1000000"), Decimal("1435000"))
    assert etat["rapproche"] is True
    assert etat["residu"] == "0"
