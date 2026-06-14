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
  const modeClass = mode === "autopilot" ? "neon-glow-orange border-orange-500/40 text-orange-400 bg-orange-950/20" : "neon-glow-blue border-blue-500/40 text-blue-400 bg-blue-950/20";

  return (
    <GlassCard className="space-y-4 border border-slate-800/80 bg-slate-950/30 backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
        <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Governance-Modus</p>
        <span className={`rounded-full border px-3 py-0.5 text-[10px] font-bold tracking-wider transition-all duration-300 ${modeClass}`}>
          {mode === "autopilot" ? "Autopilot" : "Guardian"}
        </span>
      </div>

      <div className="space-y-3">
        <p className="text-[10px] text-gray-400 leading-relaxed">
          {mode === "autopilot" 
            ? "Der Autopilot-Modus erlaubt dem System eigenständig Entscheidungen im Hintergrund zu treffen (schnelle Antworten, automatische Konsolidierung)."
            : "Der Guardian-Modus sichert alle Aktionen durch manuelle Bestätigungen ab (maximale Transparenz und Governance)."}
        </p>

        <button
          type="button"
          className="w-full rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-900 hover:border-blue-500/40 px-3 py-2 text-xs font-semibold text-gray-200 transition-all duration-200 cursor-pointer shadow-inner"
          onClick={() => setConfirmOpen(true)}
        >
          Zu {target === "autopilot" ? "Autopilot" : "Guardian"} wechseln
        </button>
      </div>

      {confirmOpen ? (
        <div
          role="dialog"
          aria-label="mode-confirm-dialog"
          className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/80 p-3 shadow-2xl animate-fade-in"
        >
          <p className="text-xs font-medium text-gray-200">System-Modus wirklich wechseln?</p>
          <div className="flex gap-2">
            <Button
              variant="primary"
              onClick={() => {
                setMode(target);
                setConfirmOpen(false);
              }}
              className="py-1 text-xs cursor-pointer"
            >
              Bestaetigen
            </Button>
            <Button
              variant="ghost"
              onClick={() => setConfirmOpen(false)}
              className="py-1 text-xs cursor-pointer"
            >
              Abbrechen
            </Button>
          </div>
        </div>
      ) : null}
    </GlassCard>
  );
}

export default ModeSwitch;
