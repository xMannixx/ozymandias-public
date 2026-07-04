import { useState } from "react";
import Button from "@/components/common/Button";
import InfoHint from "@/components/common/InfoHint";
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

const ACTION_HINTS = {
  confirm: "Marks this memory as correct. It stays as-is and won't need review again.",
  retract: "Marks this memory as wrong. It will no longer be used, but stays visible for history.",
  archive: "Keeps the memory for history but marks it as no longer active.",
  lock: "Prevents automatic changes (e.g. decay) until you unlock it.",
  unlock: "Allows automatic changes again.",
};

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
    return window.confirm("Retract this memory? It will be marked as wrong and will no longer be used.");
  }

  function confirmArchive(): boolean {
    return window.confirm("Archive this memory? It stays correct but is marked as no longer active.");
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {claim.verification_state === "tentative" ? (
        <span className="flex items-center gap-1">
          <Button disabled={busy || isRetracted} onClick={() => void run(() => onConfirm(claim.claim_id))}>
            Confirm
          </Button>
          <InfoHint text={ACTION_HINTS.confirm} label="What does Confirm do?" />
        </span>
      ) : null}

      <span className="flex items-center gap-1">
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
        <InfoHint text={ACTION_HINTS.retract} label="What does Retract do?" />
      </span>

      <span className="flex items-center gap-1">
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
        <InfoHint text={ACTION_HINTS.archive} label="What does Archive do?" />
      </span>

      <span className="flex items-center gap-1">
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() => void run(() => (claim.user_locked ? onUnlock(claim.claim_id) : onLock(claim.claim_id)))}
        >
          {claim.user_locked ? "Unlock" : "Lock"}
        </Button>
        <InfoHint
          text={claim.user_locked ? ACTION_HINTS.unlock : ACTION_HINTS.lock}
          label={claim.user_locked ? "What does Unlock do?" : "What does Lock do?"}
        />
      </span>

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
