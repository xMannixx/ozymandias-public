import { useState } from "react";
import GlassCard from "@/components/common/GlassCard";
import Button from "@/components/common/Button";
import { useMode, type AppMode } from "@/store/mode";

function nextMode(current: AppMode): AppMode {
  if (current === "autopilot") {
    return "guardian";
  }
  return "autopilot";
}

function ModeSwitch(): JSX.Element {
  const { mode, setMode } = useMode();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const target = nextMode(mode);
  const modeClass = mode === "autopilot" ? "neon-glow-orange" : "neon-glow-blue";

  return (
    <GlassCard className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-200">Mode</p>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${modeClass}`}>
          {mode === "autopilot" ? "Autopilot" : "Guardian"}
        </span>
      </div>

      <button
        type="button"
        className="w-full rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 hover:bg-gray-800"
        onClick={() => setConfirmOpen(true)}
      >
        Zu {target === "autopilot" ? "Autopilot" : "Guardian"} wechseln
      </button>

      {confirmOpen ? (
        <div role="dialog" aria-label="mode-confirm-dialog" className="space-y-2 rounded border border-gray-700 bg-black/30 p-3">
          <p className="text-sm text-gray-200">Modus wirklich wechseln?</p>
          <div className="flex gap-2">
            <Button
              variant="primary"
              onClick={() => {
                setMode(target);
                setConfirmOpen(false);
              }}
            >
              Bestaetigen
            </Button>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              Abbrechen
            </Button>
          </div>
        </div>
      ) : null}
    </GlassCard>
  );
}

export default ModeSwitch;
