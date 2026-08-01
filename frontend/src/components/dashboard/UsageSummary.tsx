import { useNavigate } from "react-router-dom";
import GlassCard from "@/components/common/GlassCard";
import { useUsage } from "@/hooks/useUsage";
import { formatCost, formatPercent, formatTokens } from "@/lib/usageFormat";

/** Today's spend at a glance; the full picture lives on /usage. */
function UsageSummary(): JSX.Element {
  const navigate = useNavigate();
  const { report, loading, error } = useUsage("24h");

  return (
    <GlassCard
      className="cursor-pointer space-y-2"
      onClick={() => navigate("/usage")}
      data-testid="usage-summary-card"
    >
      <h3 className="text-sm font-medium text-zinc-400">Usage, last 24 hours</h3>
      {report === null ? (
        <p className="text-sm text-zinc-500">
          {loading ? "Loading…" : `Usage unavailable. ${error ?? ""}`.trim()}
        </p>
      ) : (
        <>
          <p className="text-3xl font-semibold text-zinc-100">{formatCost(report.totals.cost_usd)}</p>
          <p className="text-sm text-zinc-400">{formatTokens(report.totals.tokens_total)} tokens</p>
          <p className="text-sm text-zinc-400">
            {formatPercent(report.totals.error_rate)} of {report.totals.calls} calls failed
          </p>
          <p className="text-xs text-zinc-500">Open for models, providers and cache hits</p>
        </>
      )}
    </GlassCard>
  );
}

export default UsageSummary;
