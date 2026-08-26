import { useMemo, useState } from "react";
import { Search } from "lucide-react";

export const AUTO_VALUE = "__auto__";

/** Above this many options, scrolling stops being a way to find anything. */
const SEARCH_THRESHOLD = 12;

type ModelPickerLabels = {
  /** aria-label of the dropdown. */
  select: string;
  /** aria-label of the free-text field shown when there is no catalogue. */
  input: string;
  /** Caption of the "let the provider decide" option. */
  auto: string;
};

type ModelPickerProps = {
  models: string[];
  /** Empty string means "use the provider default". */
  value: string;
  onChange: (model: string) => void;
  loading?: boolean;
  /** No catalogue available, so the name has to be typed. */
  unavailable?: boolean;
  labels: ModelPickerLabels;
  className?: string;
};

/**
 * Pick one model, with a filter box once the list gets long.
 *
 * OpenRouter alone offers several hundred models, which a plain dropdown cannot
 * make navigable.
 */
function ModelPicker({
  models,
  value,
  onChange,
  loading = false,
  unavailable = false,
  labels,
  className = "",
}: ModelPickerProps): JSX.Element {
  const [query, setQuery] = useState("");

  const options = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matching = needle
      ? models.filter((model) => model.toLowerCase().includes(needle))
      : models;
    // The selected model stays listed even when it is filtered out or missing
    // from the catalogue, otherwise the dropdown would render blank.
    return value && !matching.includes(value) ? [value, ...matching] : matching;
  }, [models, query, value]);

  if (unavailable) {
    return (
      <input
        aria-label={labels.input}
        className={`w-full text-sm ${className}`}
        placeholder="Model name"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  const searchable = models.length > SEARCH_THRESHOLD;

  return (
    <div className="space-y-2">
      {searchable ? (
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500"
            aria-hidden="true"
          />
          <input
            aria-label={`${labels.select}-search`}
            className={`w-full pl-7 text-sm ${className}`}
            placeholder={`Filter ${models.length} models`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      ) : null}
      <select
        aria-label={labels.select}
        className={`w-full text-sm ${className}`}
        value={value || AUTO_VALUE}
        onChange={(event) => onChange(event.target.value === AUTO_VALUE ? "" : event.target.value)}
        disabled={loading}
      >
        <option value={AUTO_VALUE}>{loading ? "Loading models…" : labels.auto}</option>
        {options.map((model) => (
          <option key={model} value={model}>
            {model}
          </option>
        ))}
      </select>
      {searchable && query.trim() && options.length === 0 ? (
        <p className="text-xs text-zinc-500">No model matches “{query.trim()}”.</p>
      ) : null}
    </div>
  );
}

export default ModelPicker;
