import type { ClaimVersionResponse } from "@/api/types";

type ClaimVersionTimelineProps = {
  versions: ClaimVersionResponse[];
};

function renderSnapshot(snapshot: Record<string, unknown>): JSX.Element {
  const entries = Object.entries(snapshot);
  if (entries.length === 0) {
    return <p className="text-xs text-gray-500">Kein Snapshot-Inhalt</p>;
  }
  return (
    <ul className="space-y-1 text-xs text-gray-300">
      {entries.slice(0, 6).map(([key, value]) => (
        <li key={key}>
          <span className="text-gray-400">{key}:</span> {String(value)}
        </li>
      ))}
    </ul>
  );
}

function ClaimVersionTimeline({ versions }: ClaimVersionTimelineProps): JSX.Element {
  const sorted = [...versions].sort((left, right) => right.version_number - left.version_number);

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-100">Versionshistorie</h3>
      {sorted.length === 0 ? (
        <p className="text-sm text-gray-400">Keine Versionen vorhanden.</p>
      ) : (
        <ul className="space-y-2">
          {sorted.map((version) => (
            <li key={version.version_id} className="rounded border border-gray-700 bg-gray-900/50 p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-400">
                <span>Version #{version.version_number}</span>
                <span className="mono">{version.version_hash.slice(0, 12)}</span>
              </div>
              <p className="mb-1 text-xs text-gray-300">
                {version.changed_by} · {new Date(version.created_at).toLocaleString()}
              </p>
              <p className="mb-2 text-xs text-gray-300">{version.change_reason ?? "Keine Begruendung"}</p>
              {renderSnapshot(version.content_snapshot)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default ClaimVersionTimeline;
