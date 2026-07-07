import { useState } from "react";
import Button from "@/components/common/Button";
import GlassCard from "@/components/common/GlassCard";
import { type RuntimeMode, useMode } from "@/store/mode";

function getTargetMode(mode: RuntimeMode): RuntimeMode {
  if (mode === "autopilot") {
    return "guardian";
  }
  return "autopilot";
}

function ModeSettings(): JSX.Element {
  const { mode, runtimeMode, setMode } = useMode();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const targetMode = getTargetMode(runtimeMode);

  return (
    <GlassCard className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-200">Mode</p>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${runtimeMode === "autopilot" ? "neon-glow-orange" : "neon-glow-blue"}`}>
          {runtimeMode === "autopilot" ? "Autopilot" : "Guardian"}
        </span>
      </div>

      {mode === "kill-switch" ? (
        <p className="text-xs text-red-300">Kill switch is active. The mode change will still be saved.</p>
      ) : null}

      <button
        type="button"
        className="w-full rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 hover:bg-gray-800"
        onClick={() => setConfirmOpen(true)}
      >
        Zu {targetMode === "autopilot" ? "Autopilot" : "Guardian"} wechseln
      </button>

      {confirmOpen ? (
        <div role="dialog" aria-label="mode-settings-confirm" className="space-y-2 rounded border border-gray-700 bg-black/30 p-3">
          <p className="text-sm text-gray-200">Really switch the mode?</p>
          <div className="flex gap-2">
            <Button
              onClick={() => {
                setMode(targetMode);
                setConfirmOpen(false);
              }}
            >
              Confirm
            </Button>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </GlassCard>
  );
}

export default ModeSettings;
