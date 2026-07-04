import Tooltip from "@/components/common/Tooltip";
import { SENSITIVITY_DESCRIPTIONS, SENSITIVITY_LABELS } from "@/lib/labels";
import type { Sensitivity } from "@/api/types";

const toneClass: Record<string, string> = {
  S0: "bg-gray-700 text-gray-200",
  S1: "bg-green-700 text-green-100",
  S2: "bg-blue-700 text-blue-100",
  S3: "bg-orange-700 text-orange-100",
  S4: "bg-purple-700 text-purple-100 ring-1 ring-purple-300",
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
  const label = SENSITIVITY_LABELS[sensitivity as Sensitivity] ?? sensitivity;
  const description = SENSITIVITY_DESCRIPTIONS[sensitivity as Sensitivity] ?? "Sensitivity level.";

  return (
    <Tooltip content={description}>
      <span tabIndex={0} className={`cursor-default rounded-full px-2 py-1 text-xs font-semibold ${tone}`}>
        {sensitivity} &middot; {label}
      </span>
    </Tooltip>
  );
}

export default SensitivityChip;
