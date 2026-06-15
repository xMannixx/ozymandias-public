"""Claim extraction from LLM outputs with safe schema defaults."""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime
from typing import Any, Protocol

from pydantic import ValidationError

from app.schemas import (
    ClaimData,
    HandlingPolicy,
    Lifecycle,
    Sensitivity,
    SourceType,
    TrustLevel,
    VerificationState,
)
from app.services.llm.base import LLMMessage, LLMResponse
from app.services.llm.router import get_llm_router

LOGGER = logging.getLogger(__name__)

EXTRACTION_SYSTEM_PROMPT = (
    "Extrahiere faktische Claims als reines JSON-Array ohne Markdown. "
    "Jeder Eintrag braucht genau diese Felder: "
    "subject, attribute, value, confidence, sensitivity, memory_type, explicit.\n"
    "WICHTIG: Wenn die Original-Nachricht eine Frage ist (endet mit '?' oder beginnt mit "
    "Fragewörtern wie 'wie', 'was', 'warum', 'wo', 'wann', 'wer', 'welche', etc.), "
    "extrahiere KEINE Claims daraus. Antworte dann mit einem leeren Array: []\n"
    "- memory_type: MUSS einer dieser Werte sein: profile, health, preference, relationship, "
    "event, location, work, finance, security, intimate\n"
    "- profile = Name, Alter, Herkunft, Beruf, persoenliche Fakten\n"
    "- health = Krankheiten, Allergien, Medikamente, koerperliche Einschraenkungen\n"
    "- preference = Vorlieben, Abneigungen, Gewohnheiten\n"
    "- relationship = Partner, Familie, Freunde, Beziehungsstatus\n"
    "- event = Termine, Ereignisse, Daten\n"
    "- location = Wohnort, Aufenthalt, Reisen\n"
    "- work = Job, Projekte, Karriere, Ausbildung\n"
    "- finance = Gehalt, Schulden, Konto, Vertraege\n"
    "- security = Passwoerter, Keys, Zugangsdaten, Sicherheitsrelevantes\n"
    "- intimate = Sexualitaet, intime Details, Beziehungsintimes\n"
    "explicit = true wenn der User es direkt gesagt hat "
    '("Merk dir X", "Ich bin 51", "Meine Freundin heisst Y"). '
    "explicit = false wenn es aus dem Kontext abgeleitet ist."
)

VALID_MEMORY_TYPES = frozenset(
    {
        "profile",
        "health",
        "preference",
        "relationship",
        "event",
        "location",
        "work",
        "finance",
        "security",
        "intimate",
    }
)

_QUESTION_WORDS = frozenset(
    {
        # German
        "wie",
        "was",
        "warum",
        "weshalb",
        "wieso",
        "wo",
        "woher",
        "wohin",
        "wozu",
        "womit",
        "wobei",
        "wann",
        "wer",
        "wen",
        "wem",
        "wessen",
        "welche",
        "welcher",
        "welches",
        "welchem",
        "welchen",
        "inwiefern",
        "inwieweit",
        # English
        "how",
        "what",
        "why",
        "where",
        "when",
        "who",
        "whom",
        "whose",
        "which",
    }
)


def _is_question(text: str) -> bool:
    """Return True if *text* is a question and should not yield any claims."""
    stripped = text.strip()
    if stripped.endswith("?"):
        return True
    first_word = stripped.split()[0].lower().rstrip(".,!;:") if stripped else ""
    return first_word in _QUESTION_WORDS


class ClaimExtractor:
    """Extract claims from model responses and validate against ClaimData."""

    def __init__(self, router: SupportsRouting | None = None) -> None:
        self._router = router or get_llm_router()

    async def extract(
        self,
        *,
        llm_response_text: str,
        original_message: str,
        sensitivity: Sensitivity,
        turn_id: str,
        api_keys: dict[str, str | None] | None = None,
    ) -> list[ClaimData]:
        if _is_question(original_message):
            LOGGER.debug("Skipping claim extraction: original_message is a question")
            return []

        messages: list[LLMMessage] = [
            {"role": "system", "content": EXTRACTION_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"Original message:\n{original_message}\n\n"
                    f"Assistant response:\n{llm_response_text}\n\n"
                    "Antworte nur mit einem JSON-Array."
                ),
            },
        ]
        route_kwargs = {}
        if api_keys is not None:
            route_kwargs["api_keys"] = api_keys
        extraction = await self._router.route(
            intent="claim_extraction",
            sensitivity=sensitivity,
            messages=messages,
            **route_kwargs,
        )
        raw_items = _parse_claim_array(extraction.content)
        if not raw_items:
            return []
        claims: list[ClaimData] = []
        for raw_item in raw_items:
            merged = _apply_defaults(
                raw_item,
                original_message=original_message,
                fallback_sensitivity=sensitivity,
                turn_id=turn_id,
            )
            try:
                claims.append(ClaimData.model_validate(merged))
            except ValidationError:
                LOGGER.warning("Skipping invalid claim payload after defaults", exc_info=True)
        return claims


def _parse_claim_array(payload: str) -> list[dict[str, Any]]:
    text = payload.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if len(lines) >= 3:
            text = "\n".join(lines[1:-1]).strip()
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        LOGGER.warning("Claim extractor returned invalid JSON payload", exc_info=True)
        return []
    if isinstance(parsed, dict):
        claims_value = parsed.get("claims")
        if isinstance(claims_value, list):
            parsed = claims_value
    if not isinstance(parsed, list):
        return []
    claims: list[dict[str, Any]] = []
    for item in parsed:
        if isinstance(item, dict):
            claims.append(item)
    return claims


def _apply_defaults(
    raw_claim: dict[str, Any],
    *,
    original_message: str,
    fallback_sensitivity: Sensitivity,
    turn_id: str,
) -> dict[str, Any]:
    claim_sensitivity = _normalize_sensitivity(raw_claim.get("sensitivity"), fallback_sensitivity)
    explicit = _is_explicit_claim(raw_claim.get("explicit", False))
    return {
        "subject": str(raw_claim.get("subject", "unknown_subject")),
        "attribute": _to_optional_str(raw_claim.get("attribute")),
        "value": str(raw_claim.get("value", "")),
        "content": str(raw_claim.get("content", original_message)),
        "memory_type": _normalize_memory_type(raw_claim.get("memory_type")),
        "sensitivity": claim_sensitivity,
        "trust_level": TrustLevel.T3 if explicit else TrustLevel.T1,
        "handling_policy": _handling_policy_for(claim_sensitivity),
        "verification_state": VerificationState.tentative,
        "confidence": _normalize_confidence(raw_claim.get("confidence")),
        "source_type": SourceType.user_explicit if explicit else SourceType.model_inferred,
        "source_ref": _to_optional_str(raw_claim.get("source_ref")) or turn_id,
        "user_locked": bool(raw_claim.get("user_locked", False)),
        "decay_eligible": bool(raw_claim.get("decay_eligible", True)),
        "lifecycle": Lifecycle.temporary,
        "valid_from": _to_optional_str(raw_claim.get("valid_from"))
        or datetime.now(tz=UTC).isoformat(),
        "valid_to": _to_optional_str(raw_claim.get("valid_to")),
    }


def _normalize_memory_type(value: Any) -> str:
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in VALID_MEMORY_TYPES:
            return normalized
    return "event"


def _normalize_sensitivity(value: Any, default: Sensitivity) -> Sensitivity:
    if isinstance(value, Sensitivity):
        return value
    if isinstance(value, str):
        normalized = value.strip().upper()
        try:
            return Sensitivity(normalized)
        except ValueError:
            return default
    return default


def _handling_policy_for(sensitivity: Sensitivity) -> HandlingPolicy:
    if sensitivity is Sensitivity.S4:
        return HandlingPolicy.s4_isolated
    if sensitivity is Sensitivity.S3:
        return HandlingPolicy.local_only
    return HandlingPolicy.cloud_ok_encrypted


def _normalize_confidence(value: Any) -> float:
    try:
        confidence = float(value)
    except TypeError:
        return 0.6
    except ValueError:
        return 0.6
    if confidence < 0.0:
        return 0.0
    if confidence > 1.0:
        return 1.0
    return confidence


def _is_explicit_claim(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"true", "1", "yes", "ja"}:
            return True
        if normalized in {"false", "0", "no", "nein"}:
            return False
    return False


def _to_optional_str(value: Any) -> str | None:
    if value is None:
        return None
    string_value = str(value).strip()
    return string_value or None


class SupportsRouting(Protocol):
    async def route(
        self,
        *,
        intent: str,
        sensitivity: Sensitivity,
        messages: list[LLMMessage],
        tools: list[dict[str, Any]] | None = None,
        api_keys: dict[str, str | None] | None = None,
    ) -> LLMResponse: ...

