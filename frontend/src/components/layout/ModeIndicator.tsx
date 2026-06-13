import { useMode } from "@/store/mode";

function ModeIndicator(): JSX.Element {
  const { mode } = useMode();

  const config =
    mode === "autopilot"
      ? { label: "Autopilot", className: "neon-glow-orange" }
      : mode === "kill-switch"
        ? { label: "Kill-Switch", className: "neon-glow-red" }
        : { label: "Guardian", className: "neon-glow-blue" };

  return (
    <div className={`rounded-full px-3 py-1 text-xs font-semibold ${config.className}`}>{config.label}</div>
  );
}

export default ModeIndicator;
