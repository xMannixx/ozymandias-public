import { labelFor, LIFECYCLE_LABELS, VERIFICATION_LABELS } from "@/lib/labels";
import { toRelativeTime } from "@/lib/relativeTime";
import type { ClaimVersionResponse } from "@/api/types";

type ClaimVersionTimelineProps = {
  versions: ClaimVersionResponse[];
};

const SNAPSHOT_FIELD_LABELS: Record<string, string> = {
  verification_state: "Status",
  lifecycle: "Kept",
  confidence: "How sure",
  sensitivity: "Privacy level",
  trust_level: "Source trust",
  handling_policy: "Processed",
  value: "Value",
  content: "Full text",
  user_locked: "Locked by you",
};

/** Renders snapshot values with the same wording used elsewhere in the app. */
function snapshotValue(key: string, value: unknown): string {
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  if (key === "confidence" && typeof value === "number") {
    return `${Math.round(value * 100)}%`;
  }
  if (key === "verification_state") {
    return labelFor(VERIFICATION_LABELS, String(value));
  }
  if (key === "lifecycle") {
    return labelFor(LIFECYCLE_LABELS, String(value));
  }
  return String(value);
}

function renderSnapshot(snapshot: Record<string, unknown>): JSX.Element {
  const entries = Object.entries(snapshot);
  if (entries.length === 0) {
    return <p className="text-xs text-zinc-600">Nothing recorded for this change.</p>;
  }
  return (
    <ul className="flex flex-wrap gap-1.5">
      {entries.slice(0, 6).map(([key, value]) => (
        <li
          key={key}
          className="rounded border border-white/[0.06] bg-white/[0.02] px-1.5 py-0.5 text-[11px] text-zinc-400"
        >
          <span className="text-zinc-500">{labelFor(SNAPSHOT_FIELD_LABELS, key)}:</span>{" "}
          <span className="text-zinc-200">{snapshotValue(key, value)}</span>
        </li>
      ))}
    </ul>
  );
}

function changedByLabel(changedBy: string): string {
  if (changedBy === "user") {
    return "You";
  }
  if (changedBy === "system") {
    return "Ozymandias";
  }
  return changedBy;
}

function ClaimVersionTimeline({ versions }: ClaimVersionTimelineProps): JSX.Element {
  const sorted = [...versions].sort((left, right) => right.version_number - left.version_number);

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-medium text-white">Version history</h3>
      <p className="text-xs text-zinc-500">Every change to this memory, newest first.</p>
      {sorted.length === 0 ? (
        <p className="text-sm text-zinc-500">No changes recorded yet.</p>
      ) : (
        <ol className="space-y-2">
          {sorted.map((version) => (
            <li key={version.version_id} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
              <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-xs text-zinc-300">
                  {`Version ${version.version_number} · ${changedByLabel(version.changed_by)}`}
                </span>
                <span className="flex items-baseline gap-2">
                  <span
                    className="mono text-[10px] text-zinc-600"
                    title="Integrity hash: proves this version has not been altered."
                  >
                    {version.version_hash.slice(0, 12)}
                  </span>
                  <span className="text-[11px] text-zinc-500" title={new Date(version.created_at).toLocaleString()}>
                    {toRelativeTime(version.created_at)}
                  </span>
                </span>
              </div>
              <p className="mb-2 text-xs text-zinc-400">{version.change_reason ?? "No reason recorded."}</p>
              {renderSnapshot(version.content_snapshot)}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export default ClaimVersionTimeline;
