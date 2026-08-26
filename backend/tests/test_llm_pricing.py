"""Tests for the model price table."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta, timezone
from decimal import Decimal

from app.services.llm.pricing import cost_usd, price_for, time_of_day_factor

#: A DeepSeek off-peak moment, so time-of-day pricing stays out of the way.
OFF_PEAK = datetime(2026, 8, 26, 14, 0, tzinfo=UTC)


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
        model="deepseek-v4-flash",
        prompt_tokens=1_000_000,
        completion_tokens=0,
        at=OFF_PEAK,
    )
    assert cost == Decimal("0.220000")


def test_retired_deepseek_aliases_are_no_longer_priced() -> None:
    # deepseek-chat and deepseek-reasoner stopped answering in July 2026; a
    # price for them would quietly bill traffic that cannot exist.
    assert price_for("deepseek", "deepseek-chat") is None
    assert price_for("deepseek", "deepseek-reasoner") is None


def test_deepseek_costs_double_during_peak_hours() -> None:
    peak = datetime(2026, 8, 26, 7, 30, tzinfo=UTC)
    charged = cost_usd(
        provider="deepseek",
        model="deepseek-v4-pro",
        prompt_tokens=1_000_000,
        completion_tokens=0,
        at=peak,
    )
    assert charged == Decimal("1.320000")


def test_only_deepseek_bills_by_the_clock() -> None:
    peak = datetime(2026, 8, 26, 7, 30, tzinfo=UTC)
    assert time_of_day_factor("deepseek", peak) == Decimal(2)
    assert time_of_day_factor("openai", peak) == Decimal(1)


def test_peak_windows_are_read_in_utc() -> None:
    # 11:30 in Berlin is 09:30 UTC, which is inside the second peak window.
    berlin = timezone(timedelta(hours=2))
    berlin_late_morning = datetime(2026, 8, 26, 11, 30, tzinfo=berlin)
    assert time_of_day_factor("deepseek", berlin_late_morning) == Decimal(2)


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
