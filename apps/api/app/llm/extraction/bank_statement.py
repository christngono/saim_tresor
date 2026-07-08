"""Extraction structurée d'un relevé bancaire (OCR sémantique).

Frontière LLM stricte :
  - Principal : Together AI — Qwen2.5-VL (vision) sur PDF/image.
  - Fallback  : Groq (texte) si l'appel vision échoue.
Le LLM NE produit QUE du JSON conforme à `ReleveExtrait`. Il ne calcule ni solde,
ni rapprochement, ni total. Toute sortie est revalidée par Pydantic ; en cas de
non-conformité → erreur, jamais de donnée « devinée » injectée dans le calcul.
"""
from __future__ import annotations

import base64
import json

import httpx

from app.config import settings
from app.schemas.reconciliation import ReleveExtrait

_INSTRUCTION = (
    "Tu es un extracteur de données. À partir de ce relevé bancaire, renvoie "
    "UNIQUEMENT un objet JSON valide (aucun texte autour) avec les clés : "
    "banque, numero_compte, periode_debut (YYYY-MM-DD), periode_fin (YYYY-MM-DD), "
    "solde_initial, solde_final, lignes[]. Chaque ligne : date_operation, "
    "date_valeur, libelle, reference, debit, credit, confiance (0 à 1). "
    "N'invente aucune valeur ; laisse null si absent. Ne calcule aucun total."
)


async def _appel_together(image_b64: str, media_type: str) -> dict:
    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(
            "https://api.together.xyz/v1/chat/completions",
            headers={"Authorization": f"Bearer {settings.together_api_key}"},
            json={
                "model": settings.together_vision_model,
                "response_format": {"type": "json_object"},
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": _INSTRUCTION},
                            {
                                "type": "image_url",
                                "image_url": {"url": f"data:{media_type};base64,{image_b64}"},
                            },
                        ],
                    }
                ],
            },
        )
        resp.raise_for_status()
        data = resp.json()
        return json.loads(data["choices"][0]["message"]["content"])


async def _appel_groq_fallback(texte: str) -> dict:
    """Fallback : le document a déjà été océrisé en texte brut (CSV/txt)."""
    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {settings.groq_api_key}"},
            json={
                "model": settings.groq_model,
                "response_format": {"type": "json_object"},
                "messages": [
                    {"role": "system", "content": _INSTRUCTION},
                    {"role": "user", "content": texte},
                ],
            },
        )
        resp.raise_for_status()
        data = resp.json()
        return json.loads(data["choices"][0]["message"]["content"])


async def extraire_releve(
    contenu: bytes, media_type: str, texte_ocr: str | None = None
) -> ReleveExtrait:
    """Retourne un relevé validé. Lève en cas de sortie LLM non conforme."""
    modele = settings.together_vision_model
    try:
        brut = await _appel_together(base64.b64encode(contenu).decode(), media_type)
    except Exception:  # noqa: BLE001 — bascule volontaire vers le fallback
        if texte_ocr is None:
            raise
        brut = await _appel_groq_fallback(texte_ocr)
        modele = f"groq/{settings.groq_model}"

    brut["modele_utilise"] = modele
    return ReleveExtrait.model_validate(brut)  # rejette toute donnée hors schéma
