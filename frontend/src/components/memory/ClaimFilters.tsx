import { useState, type SyntheticEvent } from "react";
import { SlidersHorizontal } from "lucide-react";
import type { Sensitivity } from "@/api/types";
import type { ClaimsFilters } from "@/hooks/useClaims";
import { MEMORY_TYPE_OPTIONS } from "@/constants/memoryTypes";
import {
  codeWithLabel,
  LIFECYCLE_LABELS,
  LIFECYCLE_ORDER,
  optionsWithAll,
  SENSITIVITY_DESCRIPTIONS,
  SENSITIVITY_LABELS,
  TRUST_LABELS,
  TRUST_ORDER,
  VERIFICATION_LABELS,
  VERIFICATION_ORDER,
} from "@/lib/labels";

type ClaimFiltersProps = {
  filters: ClaimsFilters;
  onChange: (next: ClaimsFilters) => void;
  onReset: () => void;
  counts?: Partial<Record<SegmentKey, number>>;
};

type SegmentKey = "all" | "needs_review" | "archived";

const segments: { id: SegmentKey; label: string; hint: string }[] = [
  { id: "all", label: "All", hint: "Everything Ozymandias currently remembers" },
  { id: "needs_review", label: "Needs review", hint: "Guesses that are waiting for you to confirm them" },
  { id: "archived", label: "Archived", hint: "Kept for history, no longer used in answers" },
];

const sensitivityOptions: Sensitivity[] = ["S0", "S1", "S2", "S3", "S4"];
const lifecycleOptions = optionsWithAll(LIFECYCLE_LABELS, LIFECYCLE_ORDER);
const verificationOptions = optionsWithAll(VERIFICATION_LABELS, VERIFICATION_ORDER);
const trustLevelOptions = [
  { value: "", label: "All" },
  ...TRUST_ORDER.map((code) => ({ value: code, label: codeWithLabel(TRUST_LABELS, code) })),
];

const selectClass =
  "mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-sm text-zinc-100";

function segmentFor(filters: ClaimsFilters): SegmentKey {
  if (filters.lifecycle === "archived") {
    return "archived";
  }
  if (filters.verificationState === "tentative") {
    return "needs_review";
  }
  return "all";
}

function ClaimFilters({ filters, onChange, onReset, counts }: ClaimFiltersProps): JSX.Element {
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
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div
          className="inline-flex rounded-lg border border-white/[0.07] bg-white/[0.02] p-0.5"
          role="group"
          aria-label="memory-segment"
        >
          {segments.map((segment) => {
            const isActive = activeSegment === segment.id;
            const count = counts?.[segment.id];
            return (
              <button
                key={segment.id}
                type="button"
                aria-pressed={isActive}
                title={segment.hint}
                onClick={() => selectSegment(segment.id)}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition ${
                  isActive ? "bg-white/[0.07] text-white" : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {segment.label}
                {count !== undefined ? (
                  <span
                    className={`rounded px-1 text-[11px] tabular-nums ${
                      isActive ? "bg-white/10 text-zinc-300" : "text-zinc-500"
                    }`}
                  >
                    {count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onReset}
          className="ml-auto rounded-lg px-2.5 py-1.5 text-xs text-zinc-500 transition hover:text-zinc-200"
        >
          Reset filters
        </button>
      </div>

      <details
        open={advancedOpen}
        onToggle={handleAdvancedToggle}
        className="rounded-xl border border-white/[0.07] bg-[color:var(--surface)]"
      >
        <summary className="flex cursor-pointer select-none items-center gap-2 px-3 py-2 text-sm text-zinc-400 hover:text-zinc-200">
          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
          Advanced filters
          {hasAdvancedFilters ? (
            <span className="rounded-full bg-[color:var(--accent)]/15 px-2 py-0.5 text-[11px] text-[color:var(--accent)]">
              active
            </span>
          ) : null}
        </summary>
        <div className="space-y-4 border-t border-white/[0.06] p-3">
          <fieldset>
            <legend className="text-xs font-medium text-zinc-300">Privacy level</legend>
            <p className="mb-2 text-xs text-zinc-500">
              How private a memory is. This decides whether it may be sent to a cloud AI or has to stay on your
              machine.
            </p>
            <div className="flex flex-wrap gap-2">
              {sensitivityOptions.map((option) => (
                <label
                  key={option}
                  title={SENSITIVITY_DESCRIPTIONS[option]}
                  className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.02] px-2 py-1 text-xs text-zinc-300 hover:border-white/[0.14]"
                >
                  <input
                    type="checkbox"
                    className="h-3 w-3"
                    checked={filters.sensitivities.includes(option)}
                    onChange={() => toggleSensitivity(option)}
                  />
                  {codeWithLabel(SENSITIVITY_LABELS, option)}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="text-xs text-zinc-300">
              Category
              <select
                className={selectClass}
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

            <label className="text-xs text-zinc-300">
              How long it is kept
              <select
                className={selectClass}
                value={filters.lifecycle}
                onChange={(event) => onChange({ ...filters, lifecycle: event.target.value })}
              >
                {lifecycleOptions.map((option) => (
                  <option key={option.value || "all"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs text-zinc-300">
              Status
              <select
                className={selectClass}
                value={filters.verificationState}
                onChange={(event) => onChange({ ...filters, verificationState: event.target.value })}
              >
                {verificationOptions.map((option) => (
                  <option key={option.value || "all"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs text-zinc-300">
              Source trust
              <select
                className={selectClass}
                value={filters.trustLevel}
                onChange={(event) => onChange({ ...filters, trustLevel: event.target.value })}
              >
                {trustLevelOptions.map((option) => (
                  <option key={option.value || "all"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </details>
    </section>
  );
}

export default ClaimFilters;
