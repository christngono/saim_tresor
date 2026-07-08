"""Génération de relances de créances clients — brouillons déterministes.

Produit un brouillon de relance par facture client échue, avec un niveau
d'escalade fonction du retard. Statut BROUILLON : aucune relance n'est envoyée
sans validation humaine explicite (contrainte non négociable).

Le texte est un gabarit déterministe ; un résumé/reformulation par LLM (Groq)
reste possible en couche narration, mais n'est jamais envoyé sans relecture.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from .anomalies import FactureData

ALGO_VERSION = "relance-1.0.0"

# Seuils d'escalade (jours de retard) → niveau de relance.
SEUIL_NIVEAU_1 = 15
SEUIL_NIVEAU_2 = 45


@dataclass
class RelanceBrouillon:
    facture_id: str
    tiers: str
    niveau: int
    canal: str
    jours_retard: int
    montant_du: Decimal
    statut: str  # toujours "BROUILLON"
    message: str


def _niveau(jours: int) -> int:
    if jours <= SEUIL_NIVEAU_1:
        return 1
    if jours <= SEUIL_NIVEAU_2:
        return 2
    return 3


def _message(f: FactureData, niveau: int, jours: int) -> str:
    ton = {
        1: "Nous vous rappelons courtoisement que",
        2: "Sauf erreur de notre part,",
        3: "Malgré nos précédentes relances,",
    }[niveau]
    return (
        f"Objet : Relance niveau {niveau} — facture {f.numero}\n"
        f"{ton} la facture {f.numero} d'un montant de {f.reste_a_payer} XAF, "
        f"échue le {f.date_echeance.isoformat()}, demeure impayée "
        f"({jours} jour(s) de retard). Merci de procéder au règlement."
    )


def generer_relances(factures: list[FactureData], date_reference: date) -> list[RelanceBrouillon]:
    relances: list[RelanceBrouillon] = []
    for f in factures:
        if f.sens != "CLIENT" or f.reste_a_payer <= 0 or f.date_echeance >= date_reference:
            continue
        jours = (date_reference - f.date_echeance).days
        niveau = _niveau(jours)
        relances.append(RelanceBrouillon(
            facture_id=f.id, tiers=f.tiers, niveau=niveau, canal="EMAIL",
            jours_retard=jours, montant_du=f.reste_a_payer, statut="BROUILLON",
            message=_message(f, niveau, jours),
        ))
    return relances
