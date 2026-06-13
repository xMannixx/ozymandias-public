import { useState } from "react";
import Button from "@/components/common/Button";
import type { ClaimResponse, Sensitivity } from "@/api/types";

type ClaimActionsProps = {
  claim: ClaimResponse;
  onConfirm: (id: string) => Promise<void>;
  onRetract: (id: string) => Promise<void>;
  onArchive: (id: string) => Promise<void>;
  onLock: (id: string) => Promise<void>;
  onUnlock: (id: string) => Promise<void>;
  onSensitivityChange: (id: string, sensitivity: Sensitivity) => Promise<void>;
};

const sensitivityOptions: Sensitivity[] = ["S0", "S1", "S2", "S3", "S4"];

function ClaimActions({
  claim,
  onConfirm,
  onRetract,
  onArchive,
  onLock,
  onUnlock,
  onSensitivityChange,
}: ClaimActionsProps): JSX.Element {
  const [busy, setBusy] = useState(false);
  const [sensitivityValue, setSensitivityValue] = useState<Sensitivity>(claim.sensitivity);
  const isRetracted = claim.verification_state === "retracted";

  async function run(action: () => Promise<void>): Promise<void> {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  }

  function confirmRetract(): boolean {
    return window.confirm("Claim wirklich zurueckziehen? Diese Aktion markiert ihn als retracted.");
  }

  function confirmArchive(): boolean {
    return window.confirm("Claim archivieren? Der Claim bleibt korrekt, wird aber als archived markiert.");
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {claim.verification_state === "tentative" ? (
        <Button disabled={busy || isRetracted} onClick={() => void run(() => onConfirm(claim.claim_id))}>
          Confirm
        </Button>
      ) : null}

      <Button
        variant="danger"
        disabled={busy || isRetracted}
        onClick={() => {
          if (confirmRetract()) {
            void run(() => onRetract(claim.claim_id));
          }
        }}
      >
        Retract
      </Button>

      <Button
        variant="ghost"
        disabled={busy || isRetracted}
        onClick={() => {
          if (confirmArchive()) {
            void run(() => onArchive(claim.claim_id));
          }
        }}
      >
        Archive
      </Button>

      <Button
        variant="ghost"
        disabled={busy}
        onClick={() => void run(() => (claim.user_locked ? onUnlock(claim.claim_id) : onLock(claim.claim_id)))}
      >
        {claim.user_locked ? "Unlock" : "Lock"}
      </Button>

      <label className="text-xs text-gray-300">
        Sensitivity
        <select
          className="ml-1 rounded border border-gray-700 bg-gray-900 px-2 py-1"
          value={sensitivityValue}
          disabled={busy || isRetracted}
          onChange={(event) => {
            const nextValue = event.target.value as Sensitivity;
            setSensitivityValue(nextValue);
            void run(() => onSensitivityChange(claim.claim_id, nextValue));
          }}
        >
          {sensitivityOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export default ClaimActions;
