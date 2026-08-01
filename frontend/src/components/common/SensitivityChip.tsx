import Tooltip from "@/components/common/Tooltip";
import { SENSITIVITY_DESCRIPTIONS, SENSITIVITY_LABELS } from "@/lib/labels";
import type { Sensitivity } from "@/api/types";

const toneClass: Record<string, string> = {
  S0: "border-zinc-500/25 bg-zinc-500/[0.12] text-zinc-300",
  S1: "border-emerald-500/25 bg-emerald-500/[0.10] text-emerald-200",
  S2: "border-sky-500/25 bg-sky-500/[0.10] text-sky-200",
  S3: "border-amber-500/25 bg-amber-500/[0.10] text-amber-200",
  S4: "border-rose-500/30 bg-rose-500/[0.12] text-rose-200",
};

const dotClass: Record<string, string> = {
  S0: "bg-zinc-400",
  S1: "bg-emerald-400",
  S2: "bg-sky-400",
  S3: "bg-amber-400",
  S4: "bg-rose-400",
};

type SensitivityChipProps = {
  sensitivity: Sensitivity | string;
};

/**
 * Human-readable counterpart to `Badge`: shows the sensitivity code plus its
 * plain-language label, with the full explanation available on hover/focus.
 */
function SensitivityChip({ sensitivity }: SensitivityChipProps): JSX.Element {
  const tone = toneClass[sensitivity] ?? toneClass.S1;
  const dot = dotClass[sensitivity] ?? dotClass.S1;
  const label = SENSITIVITY_LABELS[sensitivity as Sensitivity] ?? sensitivity;
  const description = SENSITIVITY_DESCRIPTIONS[sensitivity as Sensitivity] ?? "Sensitivity level.";

  return (
    <Tooltip content={description}>
      <span
        tabIndex={0}
        className={`inline-flex cursor-default items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${tone}`}
      >
        <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        {sensitivity} &middot; {label}
      </span>
    </Tooltip>
  );
}

export default SensitivityChip;
