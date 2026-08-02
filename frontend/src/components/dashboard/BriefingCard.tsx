import { Sunrise } from "lucide-react";
import GlassCard from "@/components/common/GlassCard";
import { useBriefing } from "@/hooks/useBriefing";
import type { BriefingSection } from "@/api/types";

function formatDay(isoDate: string): string {
  const parsed = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return isoDate;
  }
  return parsed.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

function isToday(isoDate: string): boolean {
  return isoDate === new Date().toISOString().slice(0, 10);
}

function Section({ section }: { section: BriefingSection }): JSX.Element {
  const remaining = section.total - section.items.length;
  return (
    <div className="space-y-1.5">
      <h4 className="text-xs font-medium text-zinc-400">
        {section.title}
        <span className="ml-1.5 text-zinc-600">{section.total}</span>
      </h4>
      <ul className="space-y-1 text-sm text-zinc-200">
        {section.items.map((item) => (
          <li key={item} className="truncate">
            {item}
          </li>
        ))}
        {remaining > 0 ? <li className="text-xs text-zinc-500">and {remaining} more</li> : null}
      </ul>
    </div>
  );
}

/** The morning briefing the heartbeat wrote, or why there is none yet. */
function BriefingCard(): JSX.Element {
  const { briefing, loading, error } = useBriefing();

  return (
    <GlassCard className="space-y-4" data-testid="briefing-card">
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] pb-2">
        <div className="flex items-center gap-2">
          <Sunrise className="h-4 w-4 text-amber-300" aria-hidden="true" />
          <h3 className="text-sm font-medium text-zinc-200">Today&apos;s briefing</h3>
        </div>
        {briefing ? (
          <span className="text-xs text-zinc-500">
            {isToday(briefing.briefing_date)
              ? "Today"
              : `From ${formatDay(briefing.briefing_date)}`}
          </span>
        ) : null}
      </div>

      {briefing === null ? (
        <p className="text-sm text-zinc-500">
          {loading
            ? "Loading…"
            : error
              ? `Briefing unavailable. ${error}`
              : "No briefing yet. Ozy writes one every morning at the hour you picked in Settings."}
        </p>
      ) : briefing.sections.length === 0 ? (
        <p className="text-sm text-zinc-400">Nothing needed your attention that morning.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {briefing.sections.map((section) => (
            <Section key={section.key} section={section} />
          ))}
        </div>
      )}
    </GlassCard>
  );
}

export default BriefingCard;
