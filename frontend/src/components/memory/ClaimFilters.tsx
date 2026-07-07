import { useState, type SyntheticEvent } from "react";
import type { Sensitivity } from "@/api/types";
import type { ClaimsFilters } from "@/hooks/useClaims";
import Button from "@/components/common/Button";
import { MEMORY_TYPE_OPTIONS } from "@/constants/memoryTypes";

type ClaimFiltersProps = {
  filters: ClaimsFilters;
  onChange: (next: ClaimsFilters) => void;
  onReset: () => void;
};

type SegmentKey = "all" | "needs_review" | "archived";

const segments: { id: SegmentKey; label: string }[] = [
  { id: "all", label: "All" },
  { id: "needs_review", label: "Needs review" },
  { id: "archived", label: "Archived" },
];

const sensitivityOptions: Sensitivity[] = ["S0", "S1", "S2", "S3", "S4"];
const lifecycleOptions = ["", "session", "temporary", "permanent", "expiry", "archived"];
const verificationOptions = ["", "tentative", "confirmed", "retracted", "superseded"];
const trustLevelOptions = ["", "T0", "T1", "T2", "T3"];

function segmentFor(filters: ClaimsFilters): SegmentKey {
  if (filters.lifecycle === "archived") {
    return "archived";
  }
  if (filters.verificationState === "tentative") {
    return "needs_review";
  }
  return "all";
}

function ClaimFilters({ filters, onChange, onReset }: ClaimFiltersProps): JSX.Element {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const activeSegment = segmentFor(filters);
  const hasAdvancedFilters =
    filters.sensitivities.length > 0
    || filters.memoryType !== ""
    || filters.trustLevel !== ""
    || (filters.lifecycle !== "" && activeSegment !== "archived")
    || (filters.verificationState !== "" && activeSegment !== "needs_review");

  function selectSegment(segment: SegmentKey): void {
    if (segment === "all") {
      onChange({ ...filters, verificationState: "", lifecycle: "" });
      return;
    }
    if (segment === "needs_review") {
      onChange({ ...filters, verificationState: "tentative", lifecycle: "" });
      return;
    }
    onChange({ ...filters, lifecycle: "archived", verificationState: "" });
  }

  function toggleSensitivity(value: Sensitivity): void {
    const exists = filters.sensitivities.includes(value);
    const sensitivities = exists
      ? filters.sensitivities.filter((item) => item !== value)
      : [...filters.sensitivities, value];
    onChange({ ...filters, sensitivities });
  }

  function handleAdvancedToggle(event: SyntheticEvent<HTMLDetailsElement>): void {
    setAdvancedOpen(event.currentTarget.open);
  }

  return (
    <section className="glass-card space-y-3 p-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="memory-segment">
        {segments.map((segment) => (
          <button
            key={segment.id}
            type="button"
            aria-pressed={activeSegment === segment.id}
            onClick={() => selectSegment(segment.id)}
            className={`rounded px-3 py-1 text-sm ${
              activeSegment === segment.id ? "bg-blue-700/50 text-blue-100" : "text-gray-300 hover:bg-gray-800"
            }`}
          >
            {segment.label}
          </button>
        ))}
      </div>

      <details open={advancedOpen} onToggle={handleAdvancedToggle} className="rounded border border-gray-700">
        <summary className="cursor-pointer select-none px-3 py-2 text-sm text-gray-300">
          Advanced filters{hasAdvancedFilters ? " (active)" : ""}
        </summary>
        <div className="space-y-3 border-t border-gray-700 p-3">
          <div>
            <p className="mb-2 text-sm font-medium text-gray-100">Sensitivity</p>
            <div className="flex flex-wrap gap-2">
              {sensitivityOptions.map((option) => (
                <label key={option} className="flex items-center gap-1 text-xs text-gray-200">
                  <input
                    type="checkbox"
                    checked={filters.sensitivities.includes(option)}
                    onChange={() => toggleSensitivity(option)}
                  />
                  {option}
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-4">
            <label className="text-xs text-gray-300">
              Memory Type
              <select
                className="mt-1 w-full rounded border border-gray-700 bg-gray-900 px-2 py-1"
                value={filters.memoryType}
                onChange={(event) => onChange({ ...filters, memoryType: event.target.value })}
              >
                {MEMORY_TYPE_OPTIONS.map((option) => (
                  <option key={option.value || "all"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs text-gray-300">
              Lifecycle
              <select
                className="mt-1 w-full rounded border border-gray-700 bg-gray-900 px-2 py-1"
                value={filters.lifecycle}
                onChange={(event) => onChange({ ...filters, lifecycle: event.target.value })}
              >
                {lifecycleOptions.map((option) => (
                  <option key={option || "all"} value={option}>
                    {option || "All"}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs text-gray-300">
              Verification
              <select
                className="mt-1 w-full rounded border border-gray-700 bg-gray-900 px-2 py-1"
                value={filters.verificationState}
                onChange={(event) => onChange({ ...filters, verificationState: event.target.value })}
              >
                {verificationOptions.map((option) => (
                  <option key={option || "all"} value={option}>
                    {option || "All"}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs text-gray-300">
              Trust
              <select
                className="mt-1 w-full rounded border border-gray-700 bg-gray-900 px-2 py-1"
                value={filters.trustLevel}
                onChange={(event) => onChange({ ...filters, trustLevel: event.target.value })}
              >
                {trustLevelOptions.map((option) => (
                  <option key={option || "all"} value={option}>
                    {option || "All"}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </details>

      <div className="flex justify-end">
        <Button variant="ghost" onClick={onReset}>
          Reset filters
        </Button>
      </div>
    </section>
  );
}

export default ClaimFilters;
