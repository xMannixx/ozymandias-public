import type { Sensitivity } from "@/api/types";
import type { ClaimsFilters } from "@/hooks/useClaims";
import Button from "@/components/common/Button";
import { MEMORY_TYPE_OPTIONS } from "@/constants/memoryTypes";

type ClaimFiltersProps = {
  filters: ClaimsFilters;
  onChange: (next: ClaimsFilters) => void;
  onReset: () => void;
};

const sensitivityOptions: Sensitivity[] = ["S0", "S1", "S2", "S3", "S4"];

const lifecycleOptions = ["", "session", "temporary", "permanent", "expiry", "archived"];
const verificationOptions = ["", "tentative", "confirmed", "retracted", "superseded"];
const trustLevelOptions = ["", "T0", "T1", "T2", "T3", "T4"];

function ClaimFilters({ filters, onChange, onReset }: ClaimFiltersProps): JSX.Element {
  function toggleSensitivity(value: Sensitivity): void {
    const exists = filters.sensitivities.includes(value);
    const sensitivities = exists
      ? filters.sensitivities.filter((item) => item !== value)
      : [...filters.sensitivities, value];
    onChange({ ...filters, sensitivities });
  }

  return (
    <section className="glass-card space-y-3 p-3">
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
                {option || "Alle"}
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
                {option || "Alle"}
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
                {option || "Alle"}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex justify-end">
        <Button variant="ghost" onClick={onReset}>
          Filter zuruecksetzen
        </Button>
      </div>
    </section>
  );
}

export default ClaimFilters;
