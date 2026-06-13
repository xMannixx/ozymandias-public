"""Sensitivity-aware LLM provider router."""

from __future__ import annotations

from functools import lru_cache
from typing import Any

from app.config import get_settings
from app.schemas import Sensitivity
from app.services.errors import LocalProviderUnavailableError, ServiceError
from app.services.llm.base import LLMMessage, LLMProvider, LLMResponse
from app.services.llm.deepseek import DeepSeekProvider
from app.services.llm.gemini import GeminiProvider
from app.services.llm.lmstudio import LMStudioProvider
from app.services.llm.ollama import OllamaProvider
from app.services.llm.openai_provider import OpenAIProvider


class LLMRouter:
    """Route LLM calls to the correct provider based on intent and sensitivity."""

    def __init__(self) -> None:
        settings = get_settings()
        self._providers: dict[str, LLMProvider] = {"ollama": OllamaProvider()}
        if settings.lmstudio_model:
            self._providers["lmstudio"] = LMStudioProvider()

        if settings.deepseek_api_key:
            self._providers["deepseek"] = DeepSeekProvider()
        if settings.openai_api_key:
            self._providers["openai"] = OpenAIProvider()
        if settings.gemini_api_key:
            self._providers["gemini"] = GeminiProvider()

    @property
    def available_providers(self) -> list[str]:
        """Return provider names configured at startup."""
        return list(self._providers.keys())

    def get_model_name(self, provider_name: str) -> str:
        """Return the configured default model for one provider."""
        normalized_provider = provider_name.strip().lower()
        provider = self._providers.get(normalized_provider)
        if provider is None:
            raise ServiceError(f"Provider '{normalized_provider}' not configured — set the API key")
        model_name = getattr(provider, "_model_name", "")
        return str(model_name)

    async def route(
        self,
        *,
        intent: str,
        sensitivity: Sensitivity,
        enforce_local: bool = True,
        messages: list[LLMMessage],
        tools: list[dict[str, Any]] | None = None,
        preferred_provider: str | None = None,
        preferred_model: str | None = None,
        preferred_local_provider: str | None = None,
        preferred_local_model: str | None = None,
    ) -> LLMResponse:
        """Select provider and execute one chat request."""
        provider = self.select_provider(
            intent=intent,
            sensitivity=sensitivity,
            enforce_local=enforce_local,
            preferred_provider=preferred_provider,
            preferred_local_provider=preferred_local_provider,
        )
        provider_name = self._provider_name(provider)
        model_override = preferred_model
        if provider_name in {"ollama", "lmstudio"}:
            # For local providers prefer the dedicated local model setting so
            # cloud model names from chat overrides/localStorage do not leak through.
            if preferred_local_model:
                model_override = preferred_local_model
            elif enforce_local and sensitivity in {Sensitivity.S3, Sensitivity.S4}:
                model_override = None
        try:
            return await provider.chat(messages, tools=tools, model=model_override)
        except Exception as exc:
            if (
                provider_name in {"ollama", "lmstudio"}
                and enforce_local
                and sensitivity in {Sensitivity.S3, Sensitivity.S4}
                and _is_connection_error(exc)
            ):
                raise LocalProviderUnavailableError(
                    provider=provider_name,
                    sensitivity=sensitivity.value,
                    fallback_allowed=sensitivity is Sensitivity.S3,
                    detail=str(exc),
                ) from exc
            raise

    def select_provider(
        self,
        *,
        intent: str,
        sensitivity: Sensitivity,
        enforce_local: bool = True,
        preferred_provider: str | None = None,
        preferred_local_provider: str | None = None,
    ) -> LLMProvider:
        """Return one cached provider instance or fail with clear config error."""
        if enforce_local and sensitivity in {Sensitivity.S4, Sensitivity.S3}:
            try:
                local_provider_name = self._get_local_provider(
                    preferred_local_provider=preferred_local_provider
                )
            except ServiceError as exc:
                raise LocalProviderUnavailableError(
                    provider="local",
                    sensitivity=sensitivity.value,
                    fallback_allowed=sensitivity is Sensitivity.S3,
                    detail=str(exc),
                ) from exc
            provider = self._providers.get(local_provider_name)
            if provider is not None:
                return provider
            raise LocalProviderUnavailableError(
                provider=local_provider_name,
                sensitivity=sensitivity.value,
                fallback_allowed=sensitivity is Sensitivity.S3,
                detail=f"Provider '{local_provider_name}' not configured — set the API key",
            )

        if preferred_provider:
            normalized_preferred_provider = preferred_provider.strip().lower()
            preferred = self._providers.get(normalized_preferred_provider)
            if preferred is not None:
                return preferred

        name = self._resolve_provider_name(
            intent=intent,
            sensitivity=sensitivity,
            enforce_local=enforce_local,
        )
        provider = self._providers.get(name)
        if provider is not None:
            return provider

        # Dev-friendly fallback: use any configured provider only in explicit bypass mode.
        settings = get_settings()
        if getattr(settings, "auth_dev_bypass", False):
            for candidate in ("deepseek", "openai", "gemini", "ollama", "lmstudio"):
                candidate_provider = self._providers.get(candidate)
                if candidate_provider is not None:
                    return candidate_provider

        raise ServiceError(f"Provider '{name}' not configured — set the API key")

    def _resolve_provider_name(
        self,
        *,
        intent: str,
        sensitivity: Sensitivity,
        enforce_local: bool = True,
    ) -> str:
        normalized_intent = intent.strip().lower()
        if enforce_local and sensitivity in {Sensitivity.S4, Sensitivity.S3}:
            return self._get_local_provider()
        if normalized_intent == "intimate_reflection":
            return self._get_local_provider()
        if normalized_intent in {"tool_call", "critical_action"}:
            return "openai"
        if normalized_intent in {"creative", "talk"}:
            return "gemini"
        if normalized_intent == "claim_extraction":
            return "deepseek"
        return "deepseek"

    def _get_local_provider(self, *, preferred_local_provider: str | None = None) -> str:
        if preferred_local_provider:
            normalized_local_provider = preferred_local_provider.strip().lower()
            if (
                normalized_local_provider in {"ollama", "lmstudio"}
                and normalized_local_provider in self._providers
            ):
                return normalized_local_provider
        if "ollama" in self._providers:
            return "ollama"
        if "lmstudio" in self._providers:
            return "lmstudio"
        raise ServiceError("No local provider configured for S3/S4 content")

    def _provider_name(self, provider: LLMProvider) -> str | None:
        for provider_name, instance in self._providers.items():
            if instance is provider:
                return provider_name
        return None


@lru_cache(maxsize=1)
def get_llm_router() -> LLMRouter:
    """Return shared router with cached provider clients."""
    return LLMRouter()


def _is_connection_error(exc: Exception) -> bool:
    error_text = str(exc).lower()
    markers = (
        "failed to connect",
        "connection refused",
        "connecterror",
        "connection error",
        "all connection attempts failed",
        "unreachable",
    )
    return any(marker in error_text for marker in markers)
