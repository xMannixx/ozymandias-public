import { useMemo, useState } from "react";
import { OctagonX } from "lucide-react";
import Button from "@/components/common/Button";
import SettingsCard from "@/components/settings/SettingsCard";
import { useMode } from "@/store/mode";

const CONFIRMATION_TEXT = "KILL SWITCH";

function KillSwitch(): JSX.Element {
  const { killSwitch, toggleKillSwitch } = useMode();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmationValue, setConfirmationValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const target = !killSwitch;
  const isValid = useMemo(
    () => confirmationValue.trim().toUpperCase() === CONFIRMATION_TEXT,
    [confirmationValue],
  );

  const reset = (): void => {
    setConfirmOpen(false);
    setConfirmationValue("");
    setSubmitting(false);
  };

  return (
    <SettingsCard
      title="Kill switch"
      description="An emergency stop. While it is on, Ozymandias will not answer messages or touch your data at all."
      badge={
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
            killSwitch
              ? "border-rose-500/30 bg-rose-500/[0.08] text-rose-200"
              : "border-white/10 bg-white/[0.03] text-zinc-300"
          }`}
        >
          <OctagonX
            className={`h-3.5 w-3.5 ${killSwitch ? "text-rose-400" : "text-zinc-500"}`}
            aria-hidden="true"
          />
          {killSwitch ? "On — everything paused" : "Off — running normally"}
        </span>
      }
    >
      <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
        <p className="text-xs leading-relaxed text-zinc-400">
          {killSwitch
            ? "Chat, memory writes and background jobs are all stopped on the server. Nothing is lost — turning "
              + "the switch off resumes normal operation with your settings intact."
            : "Use this if Ozymandias behaves in a way you did not expect and you want it to stop immediately. "
              + "It stops chat replies, memory writes and background jobs on the server. Your data and settings "
              + "stay untouched."}
        </p>
      </div>

      {confirmOpen ? (
        <div
          role="dialog"
          aria-label="kill-switch-confirm"
          className="space-y-3 rounded-md border border-white/[0.08] bg-black/30 p-3"
        >
          <div>
            <p className="text-sm font-medium text-zinc-100">
              {target ? "Stop Ozymandias completely?" : "Resume normal operation?"}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-400">
              To avoid hitting this by accident, type <span className="font-semibold text-zinc-200">{CONFIRMATION_TEXT}</span>{" "}
              below to confirm.
            </p>
          </div>
          <input
            aria-label="kill-switch-confirm-input"
            type="text"
            value={confirmationValue}
            placeholder={CONFIRMATION_TEXT}
            onChange={(event) => setConfirmationValue(event.target.value)}
            className="w-full text-sm"
          />
          <div className="flex gap-2">
            <Button
              variant="danger"
              disabled={!isValid || submitting}
              onClick={async () => {
                setSubmitting(true);
                await toggleKillSwitch(target);
                reset();
              }}
            >
              {target ? "Enable" : "Disable"}
            </Button>
            <Button variant="ghost" disabled={submitting} onClick={reset}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button variant={killSwitch ? "ghost" : "danger"} onClick={() => setConfirmOpen(true)}>
          {killSwitch ? "Disable kill switch" : "Enable kill switch"}
        </Button>
      )}
    </SettingsCard>
  );
}

export default KillSwitch;
