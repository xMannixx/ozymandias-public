import type { UsageRange } from "@/api/types";

type UsageRangeSelectorProps = {
  value: UsageRange;
  onChange: (range: UsageRange) => void;
};

const options: Array<{ value: UsageRange; label: string }> = [
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "all", label: "All time" },
];

function UsageRangeSelector({ value, onChange }: UsageRangeSelectorProps): JSX.Element {
  return (
    <div
      className="flex flex-wrap gap-1 rounded-lg border border-white/[0.07] bg-white/[0.02] p-1"
      role="group"
      aria-label="usage-range"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`rounded-md px-3 py-1.5 text-xs transition ${
            value === option.value
              ? "bg-white/[0.08] text-white"
              : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export default UsageRangeSelector;
