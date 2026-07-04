import { useState, type SyntheticEvent } from "react";
import S4AuditGuard from "@/components/audit/S4AuditGuard";
import { AUDIT_CATEGORY_LABELS, AUDIT_EVENT_LABELS, AUDIT_RESULT_LABELS, labelFor, type AuditCategory } from "@/lib/labels";
import type { AuditFilters as AuditFiltersState } from "@/hooks/useAudit";

type AuditFiltersProps = {
  filters: AuditFiltersState;
  onChange: (updater: AuditFiltersState | ((current: AuditFiltersState) => AuditFiltersState)) => void;
  onReset: () => void;
  showS4: boolean;
  onShowS4Change: (value: boolean) => void;
  category: AuditCategory | "all";
  onCategoryChange: (category: AuditCategory | "all") => void;
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

const categoryOptions: (AuditCategory | "all")[] = ["all", "memory", "actions", "security", "system"];

function categoryLabel(category: AuditCategory | "all"): string {
  return category === "all" ? "All" : AUDIT_CATEGORY_LABELS[category];
}

function AuditFilters({
  filters,
  onChange,
  onReset,
  showS4,
  onShowS4Change,
  category,
  onCategoryChange,
}: AuditFiltersProps): JSX.Element {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const hasAdvancedFilters = filters.event_type !== "" || filters.sensitivity !== "";

  function handleAdvancedToggle(event: SyntheticEvent<HTMLDetailsElement>): void {
    setAdvancedOpen(event.currentTarget.open);
  }

  return (
    <div className="glass-card space-y-3 p-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="audit-category">
        {categoryOptions.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={category === value}
            onClick={() => onCategoryChange(value)}
            className={`rounded px-3 py-1 text-sm ${
              category === value ? "bg-blue-700/50 text-blue-100" : "text-gray-300 hover:bg-gray-800"
            }`}
          >
            {categoryLabel(value)}
          </button>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs text-gray-400">
          Result
          <select
            aria-label="audit-result"
            className="rounded border border-gray-700 bg-gray-900 px-2 py-1 text-sm text-gray-100"
            value={filters.result}
            onChange={(event) => onChange((current) => ({ ...current, result: event.target.value }))}
          >
            <option value="">All</option>
            {resultValues.map((value) => (
              <option key={value} value={value}>
                {labelFor(AUDIT_RESULT_LABELS, value)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-gray-400">
          From
          <input
            aria-label="audit-after"
            type="date"
            value={filters.after}
            onChange={(event) => onChange((current) => ({ ...current, after: event.target.value }))}
            className="rounded border border-gray-700 bg-gray-900 px-2 py-1 text-sm text-gray-100"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-gray-400">
          To
          <input
            aria-label="audit-before"
            type="date"
            value={filters.before}
            onChange={(event) => onChange((current) => ({ ...current, before: event.target.value }))}
            className="rounded border border-gray-700 bg-gray-900 px-2 py-1 text-sm text-gray-100"
          />
        </label>

        <div className="flex items-end">
          <S4AuditGuard enabled={showS4} onEnable={() => onShowS4Change(true)} onDisable={() => onShowS4Change(false)} />
        </div>
      </div>

      <details open={advancedOpen} onToggle={handleAdvancedToggle} className="rounded border border-gray-700">
        <summary className="cursor-pointer select-none px-3 py-2 text-sm text-gray-300">
          Advanced filters{hasAdvancedFilters ? " (active)" : ""}
        </summary>
        <div className="grid gap-3 border-t border-gray-700 p-3 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-gray-400">
            Event type
            <select
              aria-label="audit-event-type"
              className="rounded border border-gray-700 bg-gray-900 px-2 py-1 text-sm text-gray-100"
              value={filters.event_type}
              onChange={(event) => onChange((current) => ({ ...current, event_type: event.target.value }))}
            >
              <option value="">All</option>
              {auditEventTypes.map((value) => (
                <option key={value} value={value}>
                  {labelFor(AUDIT_EVENT_LABELS, value)}
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
              <option value="">All</option>
              <option value="S0">S0</option>
              <option value="S1">S1</option>
              <option value="S2">S2</option>
              <option value="S3">S3</option>
              <option value="S4">S4</option>
            </select>
          </label>
        </div>
      </details>

      <div className="flex justify-end">
        <button
          type="button"
          className="rounded border border-gray-700 px-3 py-2 text-sm text-gray-200 hover:bg-gray-800"
          onClick={onReset}
        >
          Reset filters
        </button>
      </div>
    </div>
  );
}

export default AuditFilters;
