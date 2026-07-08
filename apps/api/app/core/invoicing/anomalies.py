"""Détection d'anomalies de facturation — 100 % déterministe (aucun LLM).

Détecte : doublons (même numéro), écarts de prix (même numéro, montants
différents), montants incohérents (HT + TVA ≠ TTC) et retards de paiement.
Aucune correction automatique : chaque anomalie est soumise à un humain.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal

ALGO_VERSION = "anomalies-1.0.0"
TOLERANCE = Decimal("1")  # écart d'arrondi toléré sur HT+TVA vs TTC (XAF)


@dataclass(frozen=True)
class FactureData:
    id: str
    sens: str  # CLIENT | FOURNISSEUR
    numero: str
    tiers: str
    date_emission: date
    date_echeance: date
    montant_ht: Decimal
    montant_tva: Decimal
    montant_ttc: Decimal
    montant_paye: Decimal

    @property
    def reste_a_payer(self) -> Decimal:
        return self.montant_ttc - self.montant_paye


@dataclass
class Anomalie:
    facture_id: str
    type: str  # DOUBLON | ECART_PRIX | MONTANT_INCOHERENT | RETARD
    detail: str


def detecter(factures: list[FactureData], date_reference: date) -> list[Anomalie]:
    anomalies: list[Anomalie] = []

    # Doublons & écarts de prix : regroupement par (sens, numéro).
    groupes: dict[tuple[str, str], list[FactureData]] = {}
    for f in factures:
        groupes.setdefault((f.sens, f.numero), []).append(f)

    for (_, numero), grp in sorted(groupes.items()):
        if len(grp) < 2:
            continue
        montants = {f.montant_ttc for f in grp}
        ecart_prix = len(montants) > 1
        for f in grp[1:]:  # la 1re occurrence est la référence
            anomalies.append(Anomalie(f.id, "DOUBLON", f"Numéro {numero} en double"))
            if ecart_prix:
                anomalies.append(Anomalie(
                    f.id, "ECART_PRIX",
                    f"Montants divergents pour {numero} : {sorted(str(m) for m in montants)}"))

    # Montant incohérent : HT + TVA ≠ TTC.
    for f in factures:
        if abs(f.montant_ht + f.montant_tva - f.montant_ttc) > TOLERANCE:
            anomalies.append(Anomalie(
                f.id, "MONTANT_INCOHERENT",
                f"HT({f.montant_ht}) + TVA({f.montant_tva}) ≠ TTC({f.montant_ttc})"))

    # Retard de paiement : créance client échue et non soldée.
    for f in factures:
        if f.sens == "CLIENT" and f.reste_a_payer > 0 and f.date_echeance < date_reference:
            jours = (date_reference - f.date_echeance).days
            anomalies.append(Anomalie(f.id, "RETARD", f"Échu depuis {jours} jour(s)"))

    return anomalies
