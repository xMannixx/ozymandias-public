"""Sensitivity-aware LLM provider router."""

from __future__ import annotations

from functools import lru_cache
from typing import Any

from app.config import get_settings
from app.schemas import Sensitivity
from app.services.errors import LocalProviderUnavailableError, ServiceError
from app.services.llm.anthropic_provider import AnthropicProvider
from app.services.llm.base import LLMMessage, LLMProvider, LLMResponse
from app.services.llm.deepseek import DeepSeekProvider
from app.services.llm.gemini import GeminiProvider
from app.services.llm.lmstudio import LMStudioProvider
from app.services.llm.mistral import MistralProvider
from app.services.llm.ollama import OllamaProvider
from app.services.llm.openai_provider import OpenAIProvider
from app.services.llm.token_usage_tracker import get_token_usage_tracker


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
        if settings.mistral_api_key:
            self._providers["mistral"] = MistralProvider()
        if settings.anthropic_api_key:
            self._providers["anthropic"] = AnthropicProvider()

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
        api_keys: dict[str, str | None] | None = None,
    ) -> LLMResponse:
        """Select provider and execute one chat request with cross-provider fallback."""
        # Ensure any runtime API keys are lazily registered before building the chain.
        self._register_runtime_keys(api_keys)

        chain = self._build_fallback_chain(
            intent=intent,
            sensitivity=sensitivity,
            enforce_local=enforce_local,
            preferred_provider=preferred_provider,
            preferred_local_provider=preferred_local_provider,
        )

        tracker = get_token_usage_tracker()
        last_exc: Exception = ServiceError("No providers available")
        for provider_name in chain:
            provider = self._providers.get(provider_name)
            if provider is None:
                continue

            # Skip cloud providers that have exceeded their daily token limit.
            if provider_name not in {"ollama", "lmstudio"} and tracker.is_limit_exceeded(
                provider_name
            ):
                last_exc = ServiceError(f"Daily token limit reached for '{provider_name}'")
                continue

            model_override = preferred_model
            if provider_name in {"ollama", "lmstudio"}:
                # Prevent cloud model names from leaking through local overrides.
                if preferred_local_model:
                    model_override = preferred_local_model
                elif enforce_local and sensitivity in {Sensitivity.S3, Sensitivity.S4}:
                    model_override = None

            api_key = api_keys.get(provider_name) if api_keys else None
            chat_kwargs: dict[str, Any] = {}
            if api_key is not None:
                chat_kwargs["api_key"] = api_key

            try:
                response = await provider.chat(
                    messages,
                    tools=tools,
                    model=model_override,
                    **chat_kwargs,
                )
                if response.tokens_used:
                    tracker.record(provider_name, response.tokens_used)
                return response
            except Exception as exc:
                # S3/S4 local-only failure — surface immediately with structured error.
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

                # Auth / permission errors are hard failures — no point retrying other providers.
                if _is_auth_error(exc):
                    raise

                last_exc = exc
                # Try next provider in the chain.

        raise last_exc

    def select_provider(
        self,
        *,
        intent: str,
        sensitivity: Sensitivity,
        enforce_local: bool = True,
        preferred_provider: str | None = None,
        preferred_local_provider: str | None = None,
        api_keys: dict[str, str | None] | None = None,
    ) -> LLMProvider:
        """Return the primary provider for one request (no fallback iteration).

        Kept for backwards-compatibility with callers that do not use route().
        """
        self._register_runtime_keys(api_keys)

        chain = self._build_fallback_chain(
            intent=intent,
            sensitivity=sensitivity,
            enforce_local=enforce_local,
            preferred_provider=preferred_provider,
            preferred_local_provider=preferred_local_provider,
        )
        for name in chain:
            provider = self._providers.get(name)
            if provider is not None:
                return provider
        raise ServiceError("No configured provider available for this request")

    def _register_runtime_keys(self, api_keys: dict[str, str | None] | None) -> None:
        """Lazily register providers supplied via per-request API keys."""
        if not api_keys:
            return
        _factory: dict[str, type[LLMProvider]] = {
            "openai": OpenAIProvider,
            "deepseek": DeepSeekProvider,
            "gemini": GeminiProvider,
            "mistral": MistralProvider,
            "anthropic": AnthropicProvider,
        }
        for provider_name, api_key in api_keys.items():
            if api_key and api_key.strip() and provider_name not in self._providers:
                factory = _factory.get(provider_name)
                if factory is not None:
                    self._providers[provider_name] = factory()

    def _build_fallback_chain(
        self,
        *,
        intent: str,
        sensitivity: Sensitivity,
        enforce_local: bool = True,
        preferred_provider: str | None = None,
        preferred_local_provider: str | None = None,
    ) -> list[str]:
        """Return an ordered list of provider names to try for this request.

        Fallback priority (S0–S2):
            preferred_provider → intent primary → Mistral → DeepSeek → OpenAI →
            Anthropic → Gemini → local (last resort)

        S3/S4 with enforce_local: only local providers, no cloud fallback.
        """
        # S3/S4 hard-local: one entry only.
        if enforce_local and sensitivity in {Sensitivity.S3, Sensitivity.S4}:
            try:
                local = self._get_local_provider(preferred_local_provider=preferred_local_provider)
                return [local]
            except ServiceError:
                return []

        chain: list[str] = []

        # 1. User's explicit preferred provider (highest priority).
        if preferred_provider:
            norm = preferred_provider.strip().lower()
            if norm in self._providers and norm not in chain:
                chain.append(norm)

        # 2. Intent-based primary provider.
        intent_primary = self._intent_primary(intent)
        if intent_primary and intent_primary not in chain:
            chain.append(intent_primary)

        # 3. Remaining cloud providers in defined cost/quality priority order.
        _CLOUD_PRIORITY = ("mistral", "deepseek", "openai", "anthropic", "gemini")
        for name in _CLOUD_PRIORITY:
            if name in self._providers and name not in chain:
                chain.append(name)

        # 4. Local providers as last resort.
        for local in ("ollama", "lmstudio"):
            if local in self._providers and local not in chain:
                chain.append(local)

        # Dev-bypass: ensure at least one provider is available.
        if not chain:
            settings = get_settings()
            if getattr(settings, "auth_dev_bypass", False):
                for candidate in (
                    "mistral",
                    "deepseek",
                    "openai",
                    "anthropic",
                    "gemini",
                    "ollama",
                    "lmstudio",
                ):
                    if candidate in self._providers:
                        chain.append(candidate)
                        break

        return chain

    def _intent_primary(self, intent: str) -> str | None:
        """Return the preferred provider name for a given intent, or None."""
        normalized = intent.strip().lower()
        if normalized == "intimate_reflection":
            return self._get_local_provider() if self._has_local() else None
        if normalized in {"tool_call", "critical_action"}:
            return "openai"
        if normalized in {"creative", "talk"}:
            return "gemini"
        if normalized == "claim_extraction":
            return "deepseek"
        return None

    def _has_local(self) -> bool:
        return "ollama" in self._providers or "lmstudio" in self._providers

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


def _is_auth_error(exc: Exception) -> bool:
    """Return True for authentication/authorisation failures — no point retrying."""
    error_text = str(exc).lower()
    markers = (
        "401",
        "403",
        "authentication",
        "unauthorized",
        "forbidden",
        "invalid api key",
        "incorrect api key",
    )
    return any(marker in error_text for marker in markers)
