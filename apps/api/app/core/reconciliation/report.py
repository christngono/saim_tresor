"""État de rapprochement bancaire conforme SYSCOHADA révisé.

Construit, à partir du résultat déterministe du matcher, l'état de rapprochement
à deux colonnes qui réconcilie :
  - le solde du compte "Banque" (comptabilité de l'entreprise)
  - le solde du relevé (compte de l'entreprise chez la banque)

Les deux soldes corrigés doivent être égaux ; le résidu non nul signale un écart
inexpliqué à instruire par un humain avant tout export.
"""
from __future__ import annotations

from decimal import Decimal

from .matcher import Ecart, ReconciliationResult

# Écarts exclus de l'ajustement automatique : anomalies à instruire, pas des
# éléments de rapprochement légitimes.
TYPES_A_INSTRUIRE = {"DOUBLON"}


def construire_etat(
    result: ReconciliationResult,
    solde_comptable: Decimal,
    solde_releve: Decimal,
) -> dict:
    ecarts_releve = [e for e in result.ecarts if e.cote == "RELEVE"]
    ecarts_ecriture = [e for e in result.ecarts if e.cote == "ECRITURE"]

    # Ajustements du solde comptable : éléments figurant au relevé, non comptabilisés.
    ajust_comptable = [e for e in ecarts_releve if e.type_ecart not in TYPES_A_INSTRUIRE]
    # Ajustements du solde relevé : éléments comptabilisés, absents du relevé.
    ajust_releve = [e for e in ecarts_ecriture if e.type_ecart not in TYPES_A_INSTRUIRE]

    somme_comptable = sum((e.montant_signe for e in ajust_comptable), Decimal("0"))
    somme_releve = sum((e.montant_signe for e in ajust_releve), Decimal("0"))

    solde_comptable_corrige = solde_comptable + somme_comptable
    solde_releve_corrige = solde_releve + somme_releve
    residu = solde_comptable_corrige - solde_releve_corrige

    a_instruire = [e for e in result.ecarts if e.type_ecart in TYPES_A_INSTRUIRE]

    return {
        "norme": "SYSCOHADA révisé",
        "algo_version": result.algo_version,
        "colonne_comptabilite": {
            "solde_initial": str(solde_comptable),
            "ajustements": [_ligne(e) for e in ajust_comptable],
            "solde_corrige": str(solde_comptable_corrige),
        },
        "colonne_releve": {
            "solde_initial": str(solde_releve),
            "ajustements": [_ligne(e) for e in ajust_releve],
            "solde_corrige": str(solde_releve_corrige),
        },
        "residu": str(residu),
        "rapproche": residu == 0,
        "nb_rapprochees": len(result.matches),
        "a_instruire": [_ligne(e) for e in a_instruire],
    }


def _ligne(e: Ecart) -> dict:
    return {
        "cote": e.cote,
        "ref_id": e.ref_id,
        "libelle": e.libelle,
        "montant": str(e.montant_signe),
        "type_ecart": e.type_ecart,
    }
