import { useMemo, useState } from "react";
import Badge from "@/components/common/Badge";
import type { AuditEntryResponse } from "@/api/types";

type AuditEntryProps = {
  entry: AuditEntryResponse;
};

const resultStyles: Record<string, string> = {
  success: "bg-green-700 text-green-100",
  failed: "bg-red-700 text-red-100",
  blocked: "bg-orange-700 text-orange-100",
  rolled_back: "bg-yellow-700 text-yellow-100",
};

const eventIcons: Record<string, string> = {
  turn_processed: "chat",
  memory_confirmed: "brain",
  memory_rejected: "brain",
  memory_superseded: "brain",
  memory_retracted: "brain",
  action_executed: "gear",
  action_blocked: "gear",
  action_rolled_back: "gear",
  sensitivity_violation: "shield",
  circuit_breaker_tripped: "bolt",
  security_event: "lock",
};

function toRelativeDate(isoValue: string): string {
  const createdAt = new Date(isoValue).getTime();
  const now = Date.now();
  const deltaSeconds = Math.max(0, Math.floor((now - createdAt) / 1000));
  if (deltaSeconds < 60) {
    return "vor wenigen Sekunden";
  }
  const deltaMinutes = Math.floor(deltaSeconds / 60);
  if (deltaMinutes < 60) {
    return `vor ${deltaMinutes} Min`;
  }
  const deltaHours = Math.floor(deltaMinutes / 60);
  if (deltaHours < 24) {
    return `vor ${deltaHours} Std`;
  }
  const deltaDays = Math.floor(deltaHours / 24);
  return `vor ${deltaDays} T`;
}

function makeReadableEventType(eventType: string): string {
  return eventType
    .split("_")
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

function AuditEntry({ entry }: AuditEntryProps): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const relative = useMemo(() => toRelativeDate(entry.created_at), [entry.created_at]);
  const icon = eventIcons[entry.event_type] ?? "event";
  const resultStyle = entry.result ? resultStyles[entry.result] ?? "bg-gray-700 text-gray-100" : "bg-gray-700 text-gray-100";

  return (
    <article
      className={`glass-card space-y-2 p-3 ${entry.sensitivity === "S4" ? "border border-purple-500/50" : ""}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span title={entry.created_at} className="text-gray-400">
          {relative}
        </span>
        <span className="rounded bg-gray-800 px-2 py-1 text-xs text-blue-200" data-testid="event-icon">
          {icon}
        </span>
      </div>

      <div className="space-y-1">
        <p className="text-sm font-medium text-gray-100">{makeReadableEventType(entry.event_type)}</p>
        {entry.source_ref ? <p className="text-xs text-gray-400">Source: {entry.source_ref}</p> : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {entry.result ? (
          <span className={`rounded px-2 py-1 text-xs font-semibold ${resultStyle}`}>{entry.result}</span>
        ) : null}
        <Badge sensitivity={entry.sensitivity} />
        <span className="rounded bg-gray-900 px-2 py-1 text-xs text-gray-300">{entry.channel}</span>
      </div>

      {entry.payload ? (
        <div className="space-y-2">
          <button
            type="button"
            className="rounded border border-gray-700 px-2 py-1 text-xs text-gray-200 hover:bg-gray-800"
            onClick={() => setExpanded((prev) => !prev)}
          >
            {expanded ? "Payload ausblenden" : "Payload anzeigen"}
          </button>
          {expanded ? (
            <pre className="overflow-x-auto rounded bg-black/40 p-2 text-xs text-gray-200">
              {JSON.stringify(entry.payload, null, 2)}
            </pre>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export default AuditEntry;
