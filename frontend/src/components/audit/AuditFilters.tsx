import S4AuditGuard from "@/components/audit/S4AuditGuard";
import type { AuditFilters as AuditFiltersState } from "@/hooks/useAudit";

type AuditFiltersProps = {
  filters: AuditFiltersState;
  onChange: (updater: AuditFiltersState | ((current: AuditFiltersState) => AuditFiltersState)) => void;
  onReset: () => void;
  showS4: boolean;
  onShowS4Change: (value: boolean) => void;
};

const auditEventTypes = [
  "turn_processed",
  "memory_confirmed",
  "memory_rejected",
  "memory_superseded",
  "memory_retracted",
  "action_executed",
  "action_blocked",
  "action_rolled_back",
  "sensitivity_violation",
  "circuit_breaker_tripped",
  "payload_sensitivity_warning",
  "taint_escalation",
  "security_event",
  "manual_override",
] as const;

const resultValues = ["success", "failed", "blocked", "rolled_back"] as const;

function AuditFilters({
  filters,
  onChange,
  onReset,
  showS4,
  onShowS4Change,
}: AuditFiltersProps): JSX.Element {
  return (
    <div className="glass-card grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-3">
      <label className="flex flex-col gap-1 text-xs text-gray-400">
        EventType
        <select
          aria-label="audit-event-type"
          className="rounded border border-gray-700 bg-gray-900 px-2 py-1 text-sm text-gray-100"
          value={filters.event_type}
          onChange={(event) => onChange((current) => ({ ...current, event_type: event.target.value }))}
        >
          <option value="">Alle</option>
          {auditEventTypes.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs text-gray-400">
        Sensitivity
        <select
          aria-label="audit-sensitivity"
          className="rounded border border-gray-700 bg-gray-900 px-2 py-1 text-sm text-gray-100"
          value={filters.sensitivity}
          onChange={(event) =>
            onChange((current) => ({
              ...current,
              sensitivity: event.target.value as AuditFiltersState["sensitivity"],
            }))
          }
        >
          <option value="">Alle</option>
          <option value="S0">S0</option>
          <option value="S1">S1</option>
          <option value="S2">S2</option>
          <option value="S3">S3</option>
          <option value="S4">S4</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs text-gray-400">
        Result
        <select
          aria-label="audit-result"
          className="rounded border border-gray-700 bg-gray-900 px-2 py-1 text-sm text-gray-100"
          value={filters.result}
          onChange={(event) => onChange((current) => ({ ...current, result: event.target.value }))}
        >
          <option value="">Alle</option>
          {resultValues.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs text-gray-400">
        Von
        <input
          aria-label="audit-after"
          type="date"
          value={filters.after}
          onChange={(event) => onChange((current) => ({ ...current, after: event.target.value }))}
          className="rounded border border-gray-700 bg-gray-900 px-2 py-1 text-sm text-gray-100"
        />
      </label>

      <label className="flex flex-col gap-1 text-xs text-gray-400">
        Bis
        <input
          aria-label="audit-before"
          type="date"
          value={filters.before}
          onChange={(event) => onChange((current) => ({ ...current, before: event.target.value }))}
          className="rounded border border-gray-700 bg-gray-900 px-2 py-1 text-sm text-gray-100"
        />
      </label>

      <div className="flex items-end justify-between gap-3">
        <S4AuditGuard
          enabled={showS4}
          onEnable={() => onShowS4Change(true)}
          onDisable={() => onShowS4Change(false)}
        />
        <button
          type="button"
          className="rounded border border-gray-700 px-3 py-2 text-sm text-gray-200 hover:bg-gray-800"
          onClick={onReset}
        >
          Filter zuruecksetzen
        </button>
      </div>
    </div>
  );
}

export default AuditFilters;
