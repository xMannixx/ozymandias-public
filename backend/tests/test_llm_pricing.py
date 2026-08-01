"""Tests for the model price table."""

from __future__ import annotations

from decimal import Decimal

from app.services.llm.pricing import cost_usd, price_for


def test_cost_splits_fresh_and_cached_prompt_tokens() -> None:
    # 500k fresh prompt at 2.50, 500k cached at 1.25, 100k output at 10.00.
    cost = cost_usd(
        provider="openai",
        model="gpt-4o",
        prompt_tokens=1_000_000,
        completion_tokens=100_000,
        cached_prompt_tokens=500_000,
    )
    assert cost == Decimal("2.875000")


def test_cost_without_cache_charges_full_input_rate() -> None:
    cost = cost_usd(
        provider="deepseek",
        model="deepseek-chat",
        prompt_tokens=1_000_000,
        completion_tokens=0,
    )
    assert cost == Decimal("0.270000")


def test_dated_model_snapshots_inherit_the_family_price() -> None:
    assert price_for("openai", "gpt-4o-2024-08-06") == price_for("openai", "gpt-4o")


def test_longest_prefix_wins_so_mini_is_not_billed_as_the_large_model() -> None:
    mini = price_for("openai", "gpt-4.1-mini-2025-04-14")
    assert mini is not None
    assert mini.input == Decimal("0.40")


def test_local_providers_are_free() -> None:
    assert cost_usd(
        provider="ollama",
        model="whatever-you-pulled",
        prompt_tokens=999_999,
        completion_tokens=999_999,
    ) == Decimal(0)


def test_unknown_model_has_no_price_instead_of_a_silent_zero() -> None:
    assert price_for("openai", "gpt-99-turbo") is None
    assert (
        cost_usd(
            provider="openai",
            model="gpt-99-turbo",
            prompt_tokens=1000,
            completion_tokens=1000,
        )
        is None
    )


def test_unknown_provider_has_no_price() -> None:
    assert price_for("some-new-vendor", "their-model") is None


def test_gemini_ids_may_be_fully_qualified() -> None:
    assert price_for("gemini", "models/gemini-2.5-pro") == price_for("gemini", "gemini-2.5-pro")


def test_cached_tokens_beyond_the_prompt_are_clamped() -> None:
    generous = cost_usd(
        provider="openai",
        model="gpt-4o",
        prompt_tokens=1_000_000,
        completion_tokens=0,
        cached_prompt_tokens=5_000_000,
    )
    assert generous == Decimal("1.250000")
