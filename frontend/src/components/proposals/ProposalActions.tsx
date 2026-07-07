import { useState } from "react";
import Button from "@/components/common/Button";
import type { ProposalResponse } from "@/api/types";

type ProposalActionsProps = {
  proposal: ProposalResponse;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string, reason?: string) => Promise<void>;
};

function ProposalActions({ proposal, onApprove, onReject }: ProposalActionsProps): JSX.Element {
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const isPending = proposal.status === "pending";

  async function run(action: () => Promise<void>): Promise<void> {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  }

  if (!isPending) {
    return (
      <p className="text-xs text-gray-400">
        Decision: <span className="font-semibold text-gray-200">{proposal.status}</span>
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy} onClick={() => void run(() => onApprove(proposal.proposal_id))}>
          Approve
        </Button>
        <Button variant="danger" disabled={busy} onClick={() => void run(() => onReject(proposal.proposal_id, reason))}>
          Reject
        </Button>
      </div>
      <input
        aria-label="reject-reason"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        className="w-full rounded border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-gray-100"
        placeholder="Optional reason for rejecting"
      />
    </div>
  );
}

export default ProposalActions;
