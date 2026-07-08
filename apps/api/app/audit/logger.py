"""Journalisation d'audit — traçabilité horodatée et attribuable.

Toute opération significative (import, calcul déterministe, extraction IA,
validation humaine) est journalisée avec son acteur : HUMAIN (utilisateurId)
ou IA (modeleIA). Exigence de conformité / audit.
"""
from typing import Any, Literal

from prisma import Json


async def log(
    tx,
    *,
    entreprise_id: str,
    acteur: Literal["HUMAIN", "IA"],
    action: str,
    entite: str,
    entite_id: str,
    utilisateur_id: str | None = None,
    modele_ia: str | None = None,
    avant: Any | None = None,
    apres: Any | None = None,
) -> None:
    await tx.auditlog.create(
        data={
            "entrepriseId": entreprise_id,
            "acteurType": acteur,
            "utilisateurId": utilisateur_id,
            "modeleIA": modele_ia,
            "action": action,
            "entite": entite,
            "entiteId": entite_id,
            "avant": Json(avant) if avant is not None else None,
            "apres": Json(apres) if apres is not None else None,
        }
    )
