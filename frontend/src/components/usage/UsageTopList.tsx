import type { UsageBreakdownItem } from "@/api/types";
import { formatCost, formatCount, formatPercent, formatTokens } from "@/lib/usageFormat";

type UsageTopListProps = {
  title: string;
  explanation: string;
  items: UsageBreakdownItem[];
  emptyText: string;
};

function UsageTopList({ title, explanation, items, emptyText }: UsageTopListProps): JSX.Element {
  const maxCalls = items.reduce((highest, item) => Math.max(highest, item.calls), 0);

  return (
    <section className="glass-card space-y-3 p-4">
      <div className="space-y-0.5">
        <h3 className="text-sm font-medium text-zinc-200">{title}</h3>
        <p className="text-xs text-zinc-500">{explanation}</p>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-zinc-500">{emptyText}</p>
      ) : (
        <ul className="space-y-2.5">
          {items.map((item) => (
            <li key={item.key} className="space-y-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-sm text-zinc-200">{item.key}</span>
                <span className="shrink-0 text-xs text-zinc-400">
                  {formatCount(item.calls)} calls · {formatTokens(item.tokens)} · {formatCost(item.cost_usd)}
                </span>
              </div>
              <div
                className="h-1 overflow-hidden rounded-full bg-white/[0.05]"
                role="presentation"
                title={`${formatPercent(item.cost_share)} of the range's cost`}
              >
                <div
                  className="h-full rounded-full bg-[color:var(--accent)]"
                  style={{ width: `${maxCalls === 0 ? 0 : (item.calls / maxCalls) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default UsageTopList;
