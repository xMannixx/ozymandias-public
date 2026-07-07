import { useMemo, useState } from "react";
import Button from "@/components/common/Button";
import GlassCard from "@/components/common/GlassCard";
import { useMode } from "@/store/mode";

const CONFIRMATION_TEXT = "KILL SWITCH";

function KillSwitch(): JSX.Element {
  const { killSwitch, toggleKillSwitch } = useMode();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmationValue, setConfirmationValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const target = !killSwitch;
  const isValid = useMemo(() => confirmationValue.trim().toUpperCase() === CONFIRMATION_TEXT, [confirmationValue]);

  const reset = (): void => {
    setConfirmOpen(false);
    setConfirmationValue("");
    setSubmitting(false);
  };

  return (
    <GlassCard className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-200">Kill-Switch</p>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${killSwitch ? "neon-glow-red" : "border border-gray-700 text-gray-300"}`}>
          {killSwitch ? "AKTIV" : "INAKTIV"}
        </span>
      </div>

      <p className="text-xs text-gray-300">
        Stops all turn processing on the server. Manual confirmation is required for safety.
      </p>

      <Button variant={killSwitch ? "ghost" : "danger"} onClick={() => setConfirmOpen(true)}>
        {killSwitch ? "Disable kill switch" : "Enable kill switch"}
      </Button>

      {confirmOpen ? (
        <div role="dialog" aria-label="kill-switch-confirm" className="space-y-2 rounded border border-gray-700 bg-black/30 p-3">
          <p className="text-sm text-gray-200">
            Type <span className="font-semibold">{CONFIRMATION_TEXT}</span> to continue.
          </p>
          <input
            aria-label="kill-switch-confirm-input"
            type="text"
            value={confirmationValue}
            onChange={(event) => setConfirmationValue(event.target.value)}
            className="w-full rounded border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100"
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
      ) : null}
    </GlassCard>
  );
}

export default KillSwitch;
