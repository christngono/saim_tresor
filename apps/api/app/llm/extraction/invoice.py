"""Extraction structurée d'une facture (OCR sémantique) — frontière LLM stricte.

Principal : Together AI / Qwen2.5-VL (vision). Fallback : Groq (texte).
Le LLM NE produit QUE du JSON conforme à `FactureExtraite` ; il ne calcule ni
DSO, ni anomalie, ni total. Sortie revalidée par Pydantic.
"""
from __future__ import annotations

import base64
import json

import httpx

from app.config import settings
from app.schemas.invoicing import FactureExtraite

_INSTRUCTION = (
    "Tu es un extracteur de données. À partir de cette facture, renvoie UNIQUEMENT "
    "un objet JSON valide (aucun texte autour) avec les clés : sens (CLIENT ou "
    "FOURNISSEUR), numero, tiers, date_emission (YYYY-MM-DD), date_echeance "
    "(YYYY-MM-DD), montant_ht, montant_tva, montant_ttc, confiance (0 à 1). "
    "N'invente aucune valeur ; laisse null si absent. Ne calcule aucun total."
)


async def _together(image_b64: str, media_type: str) -> dict:
    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(
            "https://api.together.xyz/v1/chat/completions",
            headers={"Authorization": f"Bearer {settings.together_api_key}"},
            json={
                "model": settings.together_vision_model,
                "response_format": {"type": "json_object"},
                "messages": [{
                    "role": "user",
                    "content": [
                        {"type": "text", "text": _INSTRUCTION},
                        {"type": "image_url",
                         "image_url": {"url": f"data:{media_type};base64,{image_b64}"}},
                    ],
                }],
            },
        )
        resp.raise_for_status()
        return json.loads(resp.json()["choices"][0]["message"]["content"])


async def _groq_fallback(texte: str) -> dict:
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
        return json.loads(resp.json()["choices"][0]["message"]["content"])


async def extraire_facture(
    contenu: bytes, media_type: str, texte_ocr: str | None = None
) -> FactureExtraite:
    modele = settings.together_vision_model
    try:
        brut = await _together(base64.b64encode(contenu).decode(), media_type)
    except Exception:  # noqa: BLE001 — bascule volontaire vers le fallback
        if texte_ocr is None:
            raise
        brut = await _groq_fallback(texte_ocr)
        modele = f"groq/{settings.groq_model}"
    brut["modele_utilise"] = modele
    return FactureExtraite.model_validate(brut)
