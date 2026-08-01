import { useState } from "react";
import { Check, ShieldCheck, Zap } from "lucide-react";
import Button from "@/components/common/Button";
import SettingsCard from "@/components/settings/SettingsCard";
import { type RuntimeMode, useMode } from "@/store/mode";

function getTargetMode(mode: RuntimeMode): RuntimeMode {
  if (mode === "autopilot") {
    return "guardian";
  }
  return "autopilot";
}

const modeInfo: Record<RuntimeMode, { label: string; summary: string; details: string[] }> = {
  guardian: {
    label: "Guardian",
    summary: "Ozymandias asks before it saves anything.",
    details: [
      "New memories land in Proposals and wait for your approval.",
      "Nothing is written to your knowledge base without a click from you.",
      "Best if you are still getting a feel for what it picks up.",
    ],
  },
  autopilot: {
    label: "Autopilot",
    summary: "Ozymandias saves confident memories on its own.",
    details: [
      "Clear, high-confidence facts are saved immediately.",
      "Anything uncertain still goes to Proposals for review.",
      "Faster day to day, but you review less of what it remembers.",
    ],
  },
};

function ModeSettings(): JSX.Element {
  const { mode, runtimeMode, setMode } = useMode();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const targetMode = getTargetMode(runtimeMode);
  const current = modeInfo[runtimeMode];
  const target = modeInfo[targetMode];

  return (
    <SettingsCard
      title="Approval mode"
      description="Controls whether Ozymandias needs your permission before it remembers something."
      badge={
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs font-medium text-zinc-200">
          {runtimeMode === "autopilot" ? (
            <Zap className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
          ) : (
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
          )}
          {current.label}
        </span>
      }
    >
      <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
        <p className="text-sm font-medium text-zinc-100">
          Right now: {current.label} — {current.summary}
        </p>
        <ul className="mt-2 space-y-1">
          {current.details.map((detail) => (
            <li key={detail} className="flex gap-2 text-xs text-zinc-400">
              <Check className="mt-0.5 h-3 w-3 shrink-0 text-zinc-500" aria-hidden="true" />
              <span>{detail}</span>
            </li>
          ))}
        </ul>
      </div>

      {mode === "kill-switch" ? (
        <p className="rounded-md border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2 text-xs text-amber-200">
          Kill switch is active, so Ozymandias is paused entirely. The mode change will still be saved and
          applies once you switch the kill switch off.
        </p>
      ) : null}

      {confirmOpen ? (
        <div
          role="dialog"
          aria-label="mode-settings-confirm"
          className="space-y-3 rounded-md border border-white/[0.08] bg-black/30 p-3"
        >
          <div>
            <p className="text-sm font-medium text-zinc-100">Switch to {target.label}?</p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-400">
              {target.summary} You can switch back at any time.
            </p>
          </div>
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
      ) : (
        <Button variant="ghost" onClick={() => setConfirmOpen(true)}>
          Switch to {target.label}
        </Button>
      )}
    </SettingsCard>
  );
}

export default ModeSettings;
