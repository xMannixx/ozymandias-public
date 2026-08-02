import { render, screen } from "@testing-library/react";
import UsageKpiGrid from "@/components/usage/UsageKpiGrid";
import type { UsageTotals } from "@/api/types";

function totals(overrides: Partial<UsageTotals> = {}): UsageTotals {
  return {
    messages_total: 8,
    messages_user: 4,
    messages_assistant: 4,
    sessions: 2,
    calls: 10,
    calls_failed: 1,
    error_rate: 0.1,
    tool_calls: 2,
    tokens_total: 24_000,
    tokens_input: 20_000,
    tokens_output: 4_000,
    tokens_cached: 5_000,
    tokens_per_minute: 200,
    avg_tokens_per_message: 6_000,
    cache_hit_rate: 0.25,
    avg_latency_ms: 812,
    cost_usd: 1.5,
    avg_cost_per_message: 0.375,
    unpriced_calls: 0,
    first_call_at: null,
    last_call_at: null,
    ...overrides,
  };
}

describe("UsageKpiGrid", () => {
  it("explains every number instead of showing a bare figure", () => {
    render(<UsageKpiGrid totals={totals()} />);

    expect(screen.getByText("24k")).toBeInTheDocument();
    expect(screen.getByText("20k in, 4.0k out")).toBeInTheDocument();
    expect(screen.getByText("1 of 10 calls failed, retries included")).toBeInTheDocument();
    expect(screen.getByText("4 from you, 4 from Ozy")).toBeInTheDocument();
  });

  it("warns that cost is a floor when a model has no price", () => {
    render(<UsageKpiGrid totals={totals({ unpriced_calls: 3 })} />);

    expect(
      screen.getByText("3 calls had no known price, so this is a floor"),
    ).toBeInTheDocument();
  });

  it("leaves rates blank when there is nothing to divide by", () => {
    render(
      <UsageKpiGrid
        totals={totals({
          cache_hit_rate: null,
          avg_cost_per_message: null,
          avg_tokens_per_message: null,
          tokens_per_minute: null,
          avg_latency_ms: null,
        })}
      />,
    );

    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(4);
  });
});
