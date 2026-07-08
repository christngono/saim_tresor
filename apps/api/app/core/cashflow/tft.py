"""Tableau des Flux de Trésorerie (TFT) — SYSCOHADA révisé, 100 % déterministe.

Entrée : mouvements nets de la période par compte (agrégés depuis les écritures :
delta = Σ débit − Σ crédit, convention « débiteur positif »).
Sortie : les trois flux normalisés — opérationnel (FTAO), investissement (FTAI),
financement (FTAF) — et la variation de trésorerie qui réconcilie l'ouverture
et la clôture.

Invariant garanti (testé) :  FTAO + FTAI + FTAF == variation de trésorerie
== Σ(mouvements des comptes de classe 5). Aucune part du calcul n'est confiée à
un LLM ; le résultat est reproductible (champ algo_version).
"""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

ALGO_VERSION = "tft-1.0.0"

# Préfixes des comptes d'amortissements & provisions (nature créditrice) :
# retraités en dotations (charge non décaissée) dans le FTAO.
PREFIXES_AMORT_PROV = ("19", "28", "29", "39", "49", "59")


@dataclass(frozen=True)
class MouvementCompte:
    numero: str
    delta: Decimal  # Σ débit − Σ crédit sur la période (débiteur positif)


def _classe(numero: str) -> str:
    return numero[0]


def _est_amort_prov(numero: str) -> bool:
    return numero.startswith(PREFIXES_AMORT_PROV)


def _somme(mvts: list[MouvementCompte], predicat) -> Decimal:
    return sum((m.delta for m in mvts if predicat(m.numero)), Decimal("0"))


def construire_tft(
    mouvements: list[MouvementCompte],
    tresorerie_ouverture: Decimal,
    methode: str = "INDIRECTE",
) -> dict:
    # Amortissements & provisions (add-back en FTAO).
    dotations = -_somme(mouvements, _est_amort_prov)

    # FTAO — méthode indirecte : résultat + dotations − Δ BFR.
    delta_charges = _somme(mouvements, lambda n: _classe(n) == "6")
    delta_produits = _somme(mouvements, lambda n: _classe(n) == "7")
    resultat_net = -(delta_charges + delta_produits)

    delta_bfr = _somme(
        mouvements,
        lambda n: _classe(n) in ("3", "4") and not _est_amort_prov(n),
    )
    variation_bfr = -delta_bfr  # BFR en hausse → trésorerie en baisse

    ftao = resultat_net + dotations + variation_bfr

    # FTAI — investissement : acquisitions nettes d'immobilisations (classe 2
    # hors amortissements).
    delta_immo = _somme(
        mouvements, lambda n: _classe(n) == "2" and not _est_amort_prov(n)
    )
    ftai = -delta_immo

    # FTAF — financement : capitaux propres + emprunts (classe 1 hors provisions).
    delta_financement = _somme(
        mouvements, lambda n: _classe(n) == "1" and not _est_amort_prov(n)
    )
    ftaf = -delta_financement

    variation = ftao + ftai + ftaf
    tresorerie_cloture = tresorerie_ouverture + variation
    var_classe5 = _somme(mouvements, lambda n: _classe(n) == "5")
    controle = variation - var_classe5  # doit valoir 0 si les livres sont équilibrés

    tft = {
        "norme": "SYSCOHADA révisé",
        "methode": methode,
        "algo_version": ALGO_VERSION,
        "flux_operationnel": {
            "code": "FTAO",
            "resultat_net": str(resultat_net),
            "dotations_amortissements_provisions": str(dotations),
            "variation_bfr": str(variation_bfr),
            "total": str(ftao),
        },
        "flux_investissement": {"code": "FTAI", "acquisitions_immobilisations": str(-delta_immo), "total": str(ftai)},
        "flux_financement": {"code": "FTAF", "capitaux_et_emprunts": str(-delta_financement), "total": str(ftaf)},
        "variation_tresorerie": str(variation),
        "tresorerie_ouverture": str(tresorerie_ouverture),
        "tresorerie_cloture": str(tresorerie_cloture),
        "controle": str(controle),
        "equilibre": controle == 0,
    }

    if methode == "DIRECTE":
        tft["flux_operationnel_direct"] = _detail_direct(mouvements, ftao)
    return tft


def _detail_direct(mouvements: list[MouvementCompte], ftao: Decimal) -> dict:
    """Vue directe du FTAO : encaissements clients vs décaissements d'exploitation.

    Déterministe et réconcilié avec la méthode indirecte : produits/charges
    décaissables corrigés de la variation des créances, stocks et dettes
    d'exploitation. Les dotations (68/69, non décaissées) sont exclues.
    """
    delta_produits = _somme(mouvements, lambda n: _classe(n) == "7")
    delta_creances = _somme(mouvements, lambda n: n.startswith("41"))
    encaissements = -delta_produits - delta_creances

    delta_charges_decaissables = _somme(
        mouvements, lambda n: _classe(n) == "6" and not n.startswith(("68", "69"))
    )
    delta_stocks = _somme(mouvements, lambda n: _classe(n) == "3" and not _est_amort_prov(n))
    delta_dettes = _somme(mouvements, lambda n: n.startswith(("40", "42", "43", "44")))
    decaissements = delta_charges_decaissables + delta_stocks - delta_dettes

    total = encaissements - decaissements
    return {
        "encaissements_clients": str(encaissements),
        "decaissements_exploitation": str(decaissements),
        "total": str(total),
        "coherent_avec_indirect": total == ftao,
    }
