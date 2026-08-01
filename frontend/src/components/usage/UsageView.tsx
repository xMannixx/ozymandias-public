import { Gauge, RefreshCw } from "lucide-react";
import Spinner from "@/components/common/Spinner";
import UsageErrorPanel from "@/components/usage/UsageErrorPanel";
import UsageKpiGrid from "@/components/usage/UsageKpiGrid";
import UsageRangeSelector from "@/components/usage/UsageRangeSelector";
import UsageTopList from "@/components/usage/UsageTopList";
import UsageTrendChart from "@/components/usage/UsageTrendChart";
import { useUsage } from "@/hooks/useUsage";
import { toRelativeTime } from "@/lib/relativeTime";

function UsageView(): JSX.Element {
  const { report, range, setRange, loading, error, refetch } = useUsage();

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.03] text-[color:var(--accent)]"
          >
            <Gauge className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-lg font-medium tracking-tight text-white">Usage</h2>
            <p className="mt-0.5 max-w-2xl text-sm text-zinc-500">
              What talking to Ozymandias actually consumes: tokens, time and money, per model and per
              provider. Every model call is recorded, never any prompt or answer text.
            </p>
          </div>
        </div>
        <UsageRangeSelector value={range} onChange={setRange} />
      </header>

      {loading && report === null ? (
        <div
          className="flex items-center justify-center rounded-xl border border-white/[0.07] bg-[color:var(--surface)] p-8"
          role="status"
          aria-live="polite"
        >
          <Spinner />
        </div>
      ) : report === null ? (
        <div
          className="flex flex-col items-start gap-2 rounded-xl border border-rose-500/25 bg-rose-500/[0.06] p-4"
          role="alert"
        >
          <p className="text-sm text-rose-100">Could not load usage. {error ?? "Unknown error."}</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.1] px-3 py-1.5 text-xs text-zinc-200 transition hover:bg-white/[0.05]"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Try again
          </button>
        </div>
      ) : report.totals.calls === 0 ? (
        <div className="rounded-xl border border-white/[0.07] bg-[color:var(--surface)] p-8 text-center">
          <p className="text-sm text-zinc-300">No calls recorded in this range</p>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-zinc-500">
            Recording starts with the first chat after this feature went live — there is no history to
            fill in. Send a message and come back.
          </p>
        </div>
      ) : (
        <>
          <UsageKpiGrid totals={report.totals} />

          <UsageTrendChart series={report.series} bucketUnit={report.bucket_unit} />

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <UsageTopList
              title="Models"
              explanation="Which model did the work, and what it cost"
              items={report.top_models}
              emptyText="No model calls yet."
            />
            <UsageTopList
              title="Providers"
              explanation="Local providers appear here too, at zero cost"
              items={report.top_providers}
              emptyText="No providers used yet."
            />
            <UsageTopList
              title="Purpose"
              explanation="Chat answers, claim extraction and tool calls"
              items={report.top_call_types}
              emptyText="No calls yet."
            />
            <UsageTopList
              title="Tools"
              explanation="Provider tools such as live web search"
              items={report.top_tools}
              emptyText="No tool used a model in this range."
            />
            <UsageTopList
              title="Channels"
              explanation="Where the conversation came from"
              items={report.top_channels}
              emptyText="No channel recorded yet."
            />
          </div>

          <UsageErrorPanel
            byKind={report.errors_by_kind}
            byDay={report.errors_by_day}
            byHour={report.errors_by_hour}
          />

          <p className="text-xs text-zinc-600">
            Updated {toRelativeTime(report.generated_at)}. Voice transcription and speech are billed per
            minute and are not counted here.
          </p>
        </>
      )}
    </section>
  );
}

export default UsageView;
