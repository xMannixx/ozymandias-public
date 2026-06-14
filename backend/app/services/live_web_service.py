"""Live web search service with provider-native first and connector fallback."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal

import httpx

from app.config import Settings, get_settings
from app.schemas import Sensitivity
from app.services.errors import ServiceError
from app.services.llm.base import LLMMessage
from app.services.llm.router import LLMRouter, get_llm_router

LiveWebMode = Literal["provider_native_first", "connector_only", "off"]


@dataclass(frozen=True)
class LiveWebSource:
    """Normalized source entry returned by live search."""

    title: str
    url: str
    snippet: str


@dataclass(frozen=True)
class LiveWebContext:
    """Web context to inject into turn prompts."""

    strategy: Literal["provider_native", "connector", "none"]
    sources: list[LiveWebSource]
    answer_hint: str | None = None
    detail: str | None = None


class LiveWebService:
    """Orchestrate provider-native search with connector fallback."""

    def __init__(
        self,
        *,
        router: LLMRouter | None = None,
        settings: Settings | None = None,
    ) -> None:
        self._router = router or get_llm_router()
        self._settings = settings or get_settings()

    async def search(
        self,
        *,
        query: str,
        mode: LiveWebMode,
        preferred_provider: str | None = None,
        api_keys: dict[str, str | None] | None = None,
    ) -> LiveWebContext:
        """Execute one live search flow according to configured mode."""
        cleaned_query = query.strip()
        if not cleaned_query or mode == "off":
            return LiveWebContext(strategy="none", sources=[], detail="live_web_disabled")

        if mode == "connector_only":
            connector_result = await self._search_with_connector(cleaned_query)
            return LiveWebContext(strategy="connector", sources=connector_result)

        native_result = await self._search_with_provider_native(
            cleaned_query,
            preferred_provider=preferred_provider,
            api_keys=api_keys,
        )
        if native_result is not None:
            return native_result

        connector_result = await self._search_with_connector(cleaned_query)
        return LiveWebContext(strategy="connector", sources=connector_result)

    async def _search_with_provider_native(
        self,
        query: str,
        *,
        preferred_provider: str | None,
        api_keys: dict[str, str | None] | None = None,
    ) -> LiveWebContext | None:
        provider_name = self._select_native_provider(preferred_provider, api_keys=api_keys)
        if provider_name is None:
            return None

        messages: list[LLMMessage] = [
            {
                "role": "system",
                "content": (
                    "Use live web access to gather up-to-date information. "
                    "Return a concise answer and include source links."
                ),
            },
            {"role": "user", "content": query},
        ]
        tools = [{"type": "web_search_preview"}]
        try:
            response = await self._router.route(
                intent="tool_call",
                sensitivity=Sensitivity.S1,
                enforce_local=False,
                messages=messages,
                tools=tools,
                preferred_provider=provider_name,
                api_keys=api_keys,
            )
        except Exception:
            return None

        sources = _extract_sources_from_raw_response(response.raw_response)
        if not sources:
            return None
        return LiveWebContext(
            strategy="provider_native",
            sources=sources,
            answer_hint=response.content or None,
        )

    def _select_native_provider(
        self,
        preferred_provider: str | None,
        api_keys: dict[str, str | None] | None = None,
    ) -> str | None:
        configured = set(self._router.available_providers)
        if api_keys:
            for p, val in api_keys.items():
                if val and val.strip():
                    configured.add(p)
        native_candidates = ("openai", "deepseek")
        if preferred_provider:
            normalized = preferred_provider.strip().lower()
            if normalized in native_candidates and normalized in configured:
                return normalized
        for candidate in native_candidates:
            if candidate in configured:
                return candidate
        return None


    async def _search_with_connector(self, query: str) -> list[LiveWebSource]:
        connector_url = self._settings.live_web_connector_url.strip()
        connector_key = self._settings.live_web_connector_api_key.strip()
        if not connector_url or not connector_key:
            raise ServiceError("Live web connector is not configured")

        payload = {
            "api_key": connector_key,
            "query": query,
            "search_depth": "basic",
            "max_results": 5,
        }
        timeout = self._settings.live_web_connector_timeout_seconds
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(connector_url, json=payload)
                response.raise_for_status()
                body = response.json()
        except Exception as exc:
            raise ServiceError(f"Live web connector request failed: {exc}") from exc

        sources = _extract_sources_from_connector_payload(body)
        if not sources:
            raise ServiceError("Live web connector returned no sources")
        return sources


def format_live_web_context_block(result: LiveWebContext) -> str:
    """Build one compact context block for prompt enrichment."""
    if not result.sources:
        return ""
    lines = [
        "Live web snippets (fresh external context):",
    ]
    for index, source in enumerate(result.sources, start=1):
        lines.append(f"[{index}] {source.title} | {source.url}")
        lines.append(f"    {source.snippet}")
    return "\n".join(lines)


def _extract_sources_from_connector_payload(payload: Any) -> list[LiveWebSource]:
    entries: list[Any] = []
    if isinstance(payload, dict):
        raw_results = payload.get("results")
        if isinstance(raw_results, list):
            entries = raw_results
        elif isinstance(payload.get("data"), list):
            entries = payload["data"]

    sources: list[LiveWebSource] = []
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        url = entry.get("url")
        if not isinstance(url, str) or not url.strip():
            continue
        title = entry.get("title")
        content = entry.get("content") or entry.get("snippet")
        title_text = title.strip() if isinstance(title, str) and title.strip() else "source"
        snippet_text = content.strip() if isinstance(content, str) and content.strip() else ""
        if not snippet_text:
            continue
        sources.append(
            LiveWebSource(
                title=title_text,
                url=url.strip(),
                snippet=snippet_text[:400],
            )
        )
    return sources[:5]


def _extract_sources_from_raw_response(raw_response: dict[str, Any] | None) -> list[LiveWebSource]:
    if not isinstance(raw_response, dict):
        return []

    collected: list[LiveWebSource] = []
    visited_urls: set[str] = set()

    def walk(node: Any) -> None:
        if isinstance(node, dict):
            maybe_url = node.get("url")
            if isinstance(maybe_url, str):
                cleaned_url = maybe_url.strip()
                if cleaned_url and cleaned_url not in visited_urls:
                    title = node.get("title")
                    snippet = node.get("snippet") or node.get("content") or node.get("text")
                    title_text = (
                        title.strip() if isinstance(title, str) and title.strip() else "source"
                    )
                    snippet_text = (
                        snippet.strip()
                        if isinstance(snippet, str) and snippet.strip()
                        else "live source"
                    )
                    visited_urls.add(cleaned_url)
                    collected.append(
                        LiveWebSource(
                            title=title_text,
                            url=cleaned_url,
                            snippet=snippet_text[:400],
                        )
                    )
            for value in node.values():
                walk(value)
        elif isinstance(node, list):
            for item in node:
                walk(item)

    walk(raw_response)
    return collected[:5]
