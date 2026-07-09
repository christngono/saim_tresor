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
    # prisma-client-py exige d'OMETTRE une clé Json? plutôt que d'y passer None.
    data: dict = {
        "entrepriseId": entreprise_id,
        "acteurType": acteur,
        "action": action,
        "entite": entite,
        "entiteId": entite_id,
    }
    if utilisateur_id is not None:
        data["utilisateurId"] = utilisateur_id
    if modele_ia is not None:
        data["modeleIA"] = modele_ia
    if avant is not None:
        data["avant"] = Json(avant)
    if apres is not None:
        data["apres"] = Json(apres)
    await tx.auditlog.create(data=data)
