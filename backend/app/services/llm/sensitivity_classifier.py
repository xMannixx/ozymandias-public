"""Local pre-classifier for message sensitivity."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

import httpx

from app.config import get_settings
from app.schemas import Channel, Sensitivity

S4_KEYWORDS: tuple[str, ...] = (
    "fick",
    "sex",
    "schwanz",
    "sperma",
    "spritz",
    "wichs",
    "blas",
    "lutsch",
    "schluck",
    "anal",
    "arschfick",
    "facefuck",
    "deepthroat",
    "doggy",
    "creampie",
    "squirt",
    "cum",
    "orgasm",
    "geil",
    "feucht",
    "erreg",
    "nackt",
    "nudes",
    "titten",
    "moese",
    "fotze",
    "muschi",
    "pussy",
    "cock",
    "dick",
    "blowjob",
    "handjob",
    "rimjob",
    "dreier",
    "gangbang",
    "bdsm",
    "fetisch",
    "domina",
    "sklave",
    "fesseln",
    "peitschen",
    "wuerg",
    "dildo",
    "vibrator",
    "buttplu",
    "plug",
    "pornos",
    "erotik",
    "strippen",
    "striptease",
    "swinger",
    "fremdgeh",
    "seitensprung",
    "nutte",
    "hure",
    "prostitu",
    "penis",
    "vagina",
    "klitoris",
    "hoden",
    "brustwarze",
    "schamlippe",
    "vorhaut",
    "eichel",
    "erektion",
    "erektil",
    "impotenz",
    "potenz",
    "viagra",
    "kondom",
    "verhuet",
    "pille danach",
    "abtreib",
    "fehlgeburt",
    "unfruchtbar",
    "spermiogramm",
    "geschlechtskrank",
    "hiv",
    "aids",
    "syphilis",
    "chlamyd",
    "tripper",
    "gonorrh",
    "herpes genital",
    "haemorrhoid",
    "inkontinen",
    "prostat",
    "suizid",
    "selbstmord",
    "umbring",
    "selbstverletz",
    "ritzen",
    "self-harm",
    "self harm",
    "sexual abuse",
    "missbrauch",
    "misshandl",
    "vergewaltigung",
    "rape",
    "trauma",
    "panikattack",
    "psychose",
    "zwangsgedank",
    "essstoerung",
    "bulimie",
    "magersucht",
    "totgeburt",
)

S3_KEYWORDS: tuple[str, ...] = (
    "beziehung",
    "partner",
    "gesundheit",
    "krankheit",
    "therapie",
    "depression",
    "angst",
    "finanz",
    "schulden",
    "gehalt",
    "konto",
    "familie",
)


ClassificationSource = Literal["keyword", "local_llm", "degraded", "system_channel"]


@dataclass(frozen=True)
class SensitivityClassification:
    """Sensitivity decision with provenance and classifier health state."""

    sensitivity: Sensitivity
    source: ClassificationSource
    local_classifier_available: bool


def normalize_classification(
    value: Sensitivity | SensitivityClassification,
) -> SensitivityClassification:
    """Keep backward compatibility with tests/mocks returning plain Sensitivity."""
    if isinstance(value, SensitivityClassification):
        return value
    return SensitivityClassification(
        sensitivity=value,
        source="keyword",
        local_classifier_available=True,
    )


async def _classify_with_ollama(text: str) -> SensitivityClassification:
    """Use local Ollama to classify sensitivity via HTTP."""
    settings = get_settings()
    chat_url = f"{settings.ollama_base_url.rstrip('/')}/api/chat"
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.post(
                chat_url,
                json={
                    "model": settings.ollama_model,
                    "stream": False,
                    "messages": [
                        {
                            "role": "system",
                            "content": (
                                "Klassifiziere diese Nachricht. "
                                "Antworte NUR mit S0, S1, S2, S3 oder S4.\n"
                                "S0 = oeffentlich (Wetter, Technik, "
                                "Kochen, Code, Allgemeinwissen)\n"
                                "S1 = intern (Arbeit, Alltag, Hobbies)\n"
                                "S2 = vertraulich (persoenliche Meinungen, Plaene)\n"
                                "S3 = streng (Finanzen, Gesundheit, "
                                "Vertraege, Passwoerter)\n"
                                "S4 = intim (Sexualitaet, Beziehungsdetails, "
                                "Koerperliches, Trauma, Krisen)\n"
                                "Antworte mit EINEM Wort. Nur das Level. Nichts anderes."
                            ),
                        },
                        {"role": "user", "content": text},
                    ],
                },
            )
            response.raise_for_status()
            payload = response.json()
    except Exception:
        # Degraded mode: keep chat available for non-keyword traffic.
        return SensitivityClassification(
            sensitivity=Sensitivity.S1,
            source="degraded",
            local_classifier_available=False,
        )

    if not isinstance(payload, dict):
        return SensitivityClassification(
            sensitivity=Sensitivity.S1,
            source="degraded",
            local_classifier_available=True,
        )
    message = payload.get("message")
    if not isinstance(message, dict):
        return SensitivityClassification(
            sensitivity=Sensitivity.S1,
            source="degraded",
            local_classifier_available=True,
        )
    content = message.get("content")
    if not isinstance(content, str):
        return SensitivityClassification(
            sensitivity=Sensitivity.S1,
            source="degraded",
            local_classifier_available=True,
        )

    normalized = content.strip().upper()
    for level in (
        Sensitivity.S4,
        Sensitivity.S3,
        Sensitivity.S2,
        Sensitivity.S1,
        Sensitivity.S0,
    ):
        if level.value in normalized:
            return SensitivityClassification(
                sensitivity=level,
                source="local_llm",
                local_classifier_available=True,
            )
    return SensitivityClassification(
        sensitivity=Sensitivity.S1,
        source="degraded",
        local_classifier_available=True,
    )


async def classify_sensitivity(text: str, channel: Channel) -> SensitivityClassification:
    """Classify input with deterministic keywords + local classifier fallback."""
    lowered = text.lower()
    if any(keyword in lowered for keyword in S4_KEYWORDS):
        return SensitivityClassification(
            sensitivity=Sensitivity.S4,
            source="keyword",
            local_classifier_available=True,
        )
    if any(keyword in lowered for keyword in S3_KEYWORDS):
        return SensitivityClassification(
            sensitivity=Sensitivity.S3,
            source="keyword",
            local_classifier_available=True,
        )
    if channel in {Channel.system, Channel.celery}:
        return SensitivityClassification(
            sensitivity=Sensitivity.S0,
            source="system_channel",
            local_classifier_available=True,
        )
    return await _classify_with_ollama(text)
