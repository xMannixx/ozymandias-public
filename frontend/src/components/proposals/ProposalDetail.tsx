import type { ProposalResponse } from "@/api/types";
import { MEMORY_TYPE_LABELS } from "@/constants/memoryTypes";

type ProposalDetailProps = {
  proposal: ProposalResponse;
};

function toText(value: string | null | undefined): string {
  return value && value.length > 0 ? value : "-";
}

function ProposalDetail({ proposal }: ProposalDetailProps): JSX.Element {
  const proposed = proposal.proposed_claim;
  const decidedByAuto = proposal.decided_by === "auto_confirm";

  return (
    <section className="glass-card space-y-3 p-4">
      <h3 className="text-sm font-semibold text-gray-100">Proposal Detail</h3>

      <div className="grid gap-2 text-sm md:grid-cols-2">
        <p>
          <span className="text-gray-400">subject:</span> {proposed.subject}
        </p>
        <p>
          <span className="text-gray-400">attribute:</span> {toText(proposed.attribute)}
        </p>
        <p>
          <span className="text-gray-400">value:</span> {proposed.value}
        </p>
        <p>
          <span className="text-gray-400">memory_type:</span> {MEMORY_TYPE_LABELS[proposed.memory_type] ?? proposed.memory_type}
        </p>
        <p>
          <span className="text-gray-400">sensitivity:</span> {proposed.sensitivity}
        </p>
        <p>
          <span className="text-gray-400">confidence:</span> {proposed.confidence}
        </p>
      </div>

      <div className="space-y-1 text-xs text-gray-300">
        <p>
          rejection_reason: <span className="text-gray-200">{toText(proposal.rejection_reason)}</span>
        </p>
        <p>
          created_at: <span className="text-gray-200">{toText(proposal.created_at)}</span>
        </p>
        <p>
          decided_at: <span className="text-gray-200">{toText(proposal.decided_at)}</span>
        </p>
        <p className="flex items-center gap-2">
          decided_by: <span className="text-gray-200">{toText(proposal.decided_by)}</span>
          {decidedByAuto ? (
            <span className="rounded bg-blue-900/50 px-2 py-0.5 text-xs text-blue-100">Auto</span>
          ) : null}
        </p>
      </div>
    </section>
  );
}

export default ProposalDetail;
