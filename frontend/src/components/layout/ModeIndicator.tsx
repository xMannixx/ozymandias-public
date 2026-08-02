import { useMode } from "@/store/mode";

function ModeIndicator(): JSX.Element {
  const { mode } = useMode();

  const config =
    mode === "autopilot"
      ? { label: "Autopilot", dot: "bg-amber-400", text: "text-amber-200" }
      : mode === "kill-switch"
        ? { label: "Kill-switch", dot: "bg-red-400", text: "text-red-200" }
        : { label: "Guardian", dot: "bg-emerald-400", text: "text-emerald-200" };

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs font-medium">
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      <span className={config.text}>{config.label}</span>
    </div>
  );
}

export default ModeIndicator;
