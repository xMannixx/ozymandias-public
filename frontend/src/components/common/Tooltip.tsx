import type { PropsWithChildren, ReactNode } from "react";

type TooltipProps = PropsWithChildren<{
  content: ReactNode;
  className?: string;
}>;

/**
 * CSS-only hover/focus tooltip. The trigger must be focusable (button, link,
 * or have tabIndex) for keyboard/screen-reader users to reach the tooltip.
 */
function Tooltip({ content, className = "", children }: TooltipProps): JSX.Element {
  return (
    <span className={`group relative inline-flex ${className}`.trim()}>
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-max max-w-xs -translate-x-1/2 scale-95 rounded-md border border-cyan-500/30 bg-slate-900/95 px-2 py-1 text-xs text-gray-200 opacity-0 shadow-lg transition-all duration-150 group-hover:scale-100 group-hover:opacity-100 group-focus-within:scale-100 group-focus-within:opacity-100"
      >
        {content}
      </span>
    </span>
  );
}

export default Tooltip;
