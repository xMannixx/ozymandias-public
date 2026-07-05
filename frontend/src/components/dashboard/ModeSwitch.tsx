import { useState } from "react";
import GlassCard from "@/components/common/GlassCard";
import Button from "@/components/common/Button";
import { useMode, type AppMode } from "@/store/mode";

function ModeSwitch(): JSX.Element {
  const { mode, setMode } = useMode();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const target: AppMode = mode === "autopilot" ? "guardian" : "autopilot";
  const modeClass = mode === "autopilot" 
    ? "neon-glow-orange border-orange-500/40 text-orange-400 bg-orange-950/20" 
    : "neon-glow-blue border-blue-500/40 text-blue-400 bg-blue-950/20";

  return (
    <GlassCard className="space-y-4 border border-slate-800/80 bg-slate-950/30 backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
        <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Governance-Modus</p>
        <span data-testid="mode-status" className={`rounded-full border px-3 py-0.5 text-[10px] font-bold tracking-wider transition-all duration-300 ${modeClass}`}>
          {mode === "autopilot" ? "Autopilot" : "Guardian"}
        </span>
      </div>

      <div className="space-y-3">
        <p className="text-[10px] text-gray-400 leading-relaxed min-h-[38px]">
          {mode === "autopilot" 
            ? "Autopilot mode lets the system make decisions in the background on its own (fast responses, automatic consolidation)."
            : "Guardian mode secures every action behind manual confirmation (maximum transparency and governance)."}
        </p>

        {/* Sliding Pill Control */}
        <div className="flex bg-slate-900/60 p-1 rounded-full border border-slate-800/80 relative h-9 items-center overflow-hidden">
          {/* Autopilot Button */}
          <button
            type="button"
            className={`flex-1 text-center py-1 rounded-full text-xs font-bold transition-all duration-300 relative z-10 cursor-pointer ${
              mode === "autopilot" ? "text-orange-400" : "text-gray-400 hover:text-gray-200"
            }`}
            onClick={() => {
              if (mode !== "autopilot") setConfirmOpen(true);
            }}
          >
            Autopilot
          </button>
          
          {/* Guardian Button */}
          <button
            type="button"
            className={`flex-1 text-center py-1 rounded-full text-xs font-bold transition-all duration-300 relative z-10 cursor-pointer ${
              mode === "guardian" ? "text-blue-400" : "text-gray-400 hover:text-gray-200"
            }`}
            onClick={() => {
              if (mode !== "guardian") setConfirmOpen(true);
            }}
          >
            Guardian
          </button>
          
          {/* Sliding Pill Background indicator */}
          <div
            className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full transition-all duration-300 border ${
              mode === "autopilot"
                ? "bg-orange-950/35 border-orange-500/40 shadow-[0_0_10px_rgba(240,136,62,0.15)]"
                : "bg-blue-950/35 border-blue-500/40 shadow-[0_0_10px_rgba(88,166,255,0.15)]"
            }`}
            style={{
              left: mode === "autopilot" ? "4px" : "calc(50%)"
            }}
          />
        </div>
      </div>

      {confirmOpen ? (
        <div
          role="dialog"
          aria-label="mode-confirm-dialog"
          className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/80 p-3 shadow-2xl animate-fade-in"
        >
          <p className="text-xs font-medium text-gray-200">Really switch the system mode?</p>
          <div className="flex gap-2">
            <Button
              variant="primary"
              onClick={() => {
                setMode(target);
                setConfirmOpen(false);
              }}
              className="py-1 text-xs cursor-pointer"
            >
              Confirm
            </Button>
            <Button
              variant="ghost"
              onClick={() => setConfirmOpen(false)}
              className="py-1 text-xs cursor-pointer"
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </GlassCard>
  );
}

export default ModeSwitch;

