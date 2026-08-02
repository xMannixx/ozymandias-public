import type { UsageCount } from "@/api/types";
import { formatCount } from "@/lib/usageFormat";

type UsageErrorPanelProps = {
  byKind: UsageCount[];
  byDay: UsageCount[];
  byHour: UsageCount[];
};

function Distribution({
  title,
  explanation,
  entries,
}: {
  title: string;
  explanation: string;
  entries: UsageCount[];
}): JSX.Element {
  const peak = entries.reduce((highest, entry) => Math.max(highest, entry.count), 0);

  return (
    <div className="space-y-2">
      <div className="space-y-0.5">
        <h4 className="text-xs font-medium uppercase tracking-wider text-zinc-500">{title}</h4>
        <p className="text-xs text-zinc-500">{explanation}</p>
      </div>
      <ul className="space-y-1.5">
        {entries.map((entry) => (
          <li key={entry.label} className="flex items-center gap-2">
            <span className="w-20 shrink-0 text-xs text-zinc-400">{entry.label}</span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
              <span
                className="block h-full rounded-full bg-rose-400/70"
                style={{ width: `${peak === 0 ? 0 : (entry.count / peak) * 100}%` }}
              />
            </span>
            <span className="w-8 shrink-0 text-right text-xs text-zinc-400">
              {formatCount(entry.count)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function UsageErrorPanel({ byKind, byDay, byHour }: UsageErrorPanelProps): JSX.Element {
  const total = byKind.reduce((sum, entry) => sum + entry.count, 0);

  return (
    <section className="glass-card space-y-4 p-4">
      <div className="space-y-0.5">
        <h3 className="text-sm font-medium text-zinc-200">Failures</h3>
        <p className="text-xs text-zinc-500">
          A failed call is one attempt a provider refused. Ozy usually retries with the next provider,
          so a failure here does not mean you lost an answer.
        </p>
      </div>

      {total === 0 ? (
        <p className="text-sm text-zinc-500">No failed calls in this range.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <Distribution title="By reason" explanation="Exception class, no details kept" entries={byKind} />
          <Distribution title="By day" explanation="Which days went badly" entries={byDay} />
          <Distribution title="By hour" explanation="Local hour of the failure" entries={byHour} />
        </div>
      )}
    </section>
  );
}

export default UsageErrorPanel;
