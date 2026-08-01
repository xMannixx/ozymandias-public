import type { UsageTotals } from "@/api/types";
import {
  formatCost,
  formatCount,
  formatDecimal,
  formatLatency,
  formatPercent,
  formatTokens,
} from "@/lib/usageFormat";

type UsageKpiGridProps = {
  totals: UsageTotals;
};

type Tile = {
  label: string;
  value: string;
  explanation: string;
};

function buildTiles(totals: UsageTotals): Tile[] {
  return [
    {
      label: "Messages",
      value: formatCount(totals.messages_total),
      explanation: `${formatCount(totals.messages_user)} from you, ${formatCount(
        totals.messages_assistant,
      )} from Ozy`,
    },
    {
      label: "Tokens",
      value: formatTokens(totals.tokens_total),
      explanation: `${formatTokens(totals.tokens_input)} in, ${formatTokens(totals.tokens_output)} out`,
    },
    {
      label: "Throughput",
      value:
        totals.tokens_per_minute === null
          ? "—"
          : `${formatDecimal(totals.tokens_per_minute, 0)} tok/min`,
      explanation: "Across the span between the first and last call, not the whole range",
    },
    {
      label: "Tokens per answer",
      value: formatDecimal(totals.avg_tokens_per_message, 0),
      explanation: "Average tokens spent on one answer, prompt included",
    },
    {
      label: "Cache hit rate",
      value: formatPercent(totals.cache_hit_rate),
      explanation: "Share of prompt tokens served from the provider's cache, where reported",
    },
    {
      label: "Cost",
      value: formatCost(totals.cost_usd),
      explanation:
        totals.unpriced_calls > 0
          ? `${formatCount(totals.unpriced_calls)} calls had no known price, so this is a floor`
          : "List prices of every priced call, local models cost nothing",
    },
    {
      label: "Cost per answer",
      value: formatCost(totals.avg_cost_per_message),
      explanation: "What one answer from Ozy costs on average",
    },
    {
      label: "Error rate",
      value: formatPercent(totals.error_rate),
      explanation: `${formatCount(totals.calls_failed)} of ${formatCount(totals.calls)} calls failed, retries included`,
    },
    {
      label: "Tool calls",
      value: formatCount(totals.tool_calls),
      explanation: "Calls that used a provider tool, for example live web search",
    },
    {
      label: "Sessions",
      value: formatCount(totals.sessions),
      explanation: "Chats with activity in this range",
    },
    {
      label: "Latency",
      value: formatLatency(totals.avg_latency_ms),
      explanation: "Average wait for a provider to answer",
    },
    {
      label: "Model calls",
      value: formatCount(totals.calls),
      explanation: "More than messages: extraction and tools each cost a call",
    },
  ];
}

function UsageKpiGrid({ totals }: UsageKpiGridProps): JSX.Element {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {buildTiles(totals).map((tile) => (
        <div key={tile.label} className="glass-card space-y-1 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">{tile.label}</p>
          <p className="text-2xl font-semibold tracking-tight text-white">{tile.value}</p>
          <p className="text-xs leading-snug text-zinc-500">{tile.explanation}</p>
        </div>
      ))}
    </div>
  );
}

export default UsageKpiGrid;
