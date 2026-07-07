import Tooltip from "@/components/common/Tooltip";

type InfoHintProps = {
  text: string;
  label?: string;
};

/**
 * Small "(?)" affordance placed next to governance terms (sensitivity,
 * trust, lifecycle, ...) to explain what they mean in plain language.
 */
function InfoHint({ text, label = "More information" }: InfoHintProps): JSX.Element {
  return (
    <Tooltip content={text}>
      <button
        type="button"
        aria-label={label}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-600 text-[10px] leading-none text-gray-400 hover:border-cyan-400/60 hover:text-cyan-300"
      >
        ?
      </button>
    </Tooltip>
  );
}

export default InfoHint;
