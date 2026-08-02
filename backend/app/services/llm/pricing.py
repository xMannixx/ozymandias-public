"""List prices per model, used to turn token counts into US dollars.

The table is maintained by hand from the public price lists. A model that is
not in it yields no cost at all instead of a zero, so an out-of-date table
shows up as "unpriced calls" in usage reports rather than as free traffic.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

#: Providers that run on your own hardware and therefore bill nothing per token.
LOCAL_PROVIDERS = frozenset({"ollama", "lmstudio"})

_CENT_FRACTION = Decimal("0.000001")
_PER_MILLION = Decimal(1_000_000)


@dataclass(frozen=True)
class ModelPrice:
    """USD per million tokens for one model."""

    input: Decimal
    output: Decimal
    #: Discounted rate for prompt tokens served from cache; falls back to input.
    cached_input: Decimal | None = None

    def cached_rate(self) -> Decimal:
        return self.input if self.cached_input is None else self.cached_input


def _price(input_: str, output: str, cached_input: str | None = None) -> ModelPrice:
    return ModelPrice(
        input=Decimal(input_),
        output=Decimal(output),
        cached_input=Decimal(cached_input) if cached_input is not None else None,
    )


# Keys are matched exactly first, then as a prefix, so dated snapshots like
# "gpt-4o-2024-08-06" inherit the price of their family.
_PRICES: dict[str, dict[str, ModelPrice]] = {
    "openai": {
        "gpt-4o": _price("2.50", "10.00", "1.25"),
        "gpt-4o-mini": _price("0.15", "0.60", "0.075"),
        "gpt-4.1": _price("2.00", "8.00", "0.50"),
        "gpt-4.1-mini": _price("0.40", "1.60", "0.10"),
        "gpt-4.1-nano": _price("0.10", "0.40", "0.025"),
        "o3-mini": _price("1.10", "4.40", "0.55"),
        "o4-mini": _price("1.10", "4.40", "0.275"),
    },
    "deepseek": {
        "deepseek-chat": _price("0.27", "1.10", "0.07"),
        "deepseek-reasoner": _price("0.55", "2.19", "0.14"),
    },
    "anthropic": {
        "claude-3-5-haiku": _price("0.80", "4.00", "0.08"),
        "claude-3-5-sonnet": _price("3.00", "15.00", "0.30"),
        "claude-3-7-sonnet": _price("3.00", "15.00", "0.30"),
        "claude-haiku-4": _price("1.00", "5.00", "0.10"),
        "claude-sonnet-4": _price("3.00", "15.00", "0.30"),
        "claude-opus-4": _price("15.00", "75.00", "1.50"),
    },
    "gemini": {
        "gemini-1.5-flash": _price("0.075", "0.30", "0.01875"),
        "gemini-2.0-flash": _price("0.10", "0.40", "0.025"),
        "gemini-2.0-flash-lite": _price("0.075", "0.30", "0.01875"),
        "gemini-2.5-flash": _price("0.30", "2.50", "0.075"),
        "gemini-2.5-flash-lite": _price("0.10", "0.40", "0.025"),
        "gemini-2.5-pro": _price("1.25", "10.00", "0.31"),
    },
    "mistral": {
        "mistral-large": _price("2.00", "6.00"),
        "mistral-medium": _price("0.40", "2.00"),
        "mistral-small": _price("0.20", "0.60"),
        "open-mistral-nemo": _price("0.15", "0.15"),
    },
}


def _normalize(provider: str, model: str) -> tuple[str, str]:
    normalized_model = model.strip().lower()
    # Gemini model ids are sometimes fully qualified as "models/gemini-...".
    if normalized_model.startswith("models/"):
        normalized_model = normalized_model[len("models/") :]
    return provider.strip().lower(), normalized_model


def price_for(provider: str, model: str) -> ModelPrice | None:
    """Return the list price of one model, or None when it is unknown."""
    normalized_provider, normalized_model = _normalize(provider, model)
    if normalized_provider in LOCAL_PROVIDERS:
        return ModelPrice(input=Decimal(0), output=Decimal(0), cached_input=Decimal(0))
    table = _PRICES.get(normalized_provider)
    if not table or not normalized_model:
        return None
    exact = table.get(normalized_model)
    if exact is not None:
        return exact
    matches = [key for key in table if normalized_model.startswith(key)]
    if not matches:
        return None
    return table[max(matches, key=len)]


def cost_usd(
    *,
    provider: str,
    model: str,
    prompt_tokens: int,
    completion_tokens: int,
    cached_prompt_tokens: int = 0,
) -> Decimal | None:
    """Price one call, or return None when the model has no known price."""
    price = price_for(provider, model)
    if price is None:
        return None
    cached = max(0, min(cached_prompt_tokens, prompt_tokens))
    fresh_prompt = max(0, prompt_tokens - cached)
    total = (
        Decimal(fresh_prompt) * price.input
        + Decimal(cached) * price.cached_rate()
        + Decimal(max(0, completion_tokens)) * price.output
    ) / _PER_MILLION
    return total.quantize(_CENT_FRACTION, rounding=ROUND_HALF_UP)
