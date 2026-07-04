import SensitivityChip from "@/components/common/SensitivityChip";
import { MEMORY_TYPE_LABELS } from "@/constants/memoryTypes";
import { claimSentence } from "@/lib/claimText";
import { labelFor, PROPOSAL_STATUS_LABELS, SOURCE_TYPE_LABELS } from "@/lib/labels";
import { toRelativeTime } from "@/lib/relativeTime";
import type { ProposalResponse } from "@/api/types";

type ProposalDetailProps = {
  proposal: ProposalResponse;
};

function toText(value: string | number | null | undefined): string {
  return value === null || value === undefined || value === "" ? "-" : String(value);
}

function ProposalDetail({ proposal }: ProposalDetailProps): JSX.Element {
  const proposed = proposal.proposed_claim;
  const sentence = claimSentence(proposed);
  const laneLabel = MEMORY_TYPE_LABELS[proposed.memory_type] ?? proposed.memory_type;
  const sourceLabel = labelFor(SOURCE_TYPE_LABELS, proposed.source_type);
  const isPending = proposal.status === "pending";
  const decidedByAuto = proposal.decided_by === "auto_confirm";

  return (
    <section className="glass-card space-y-4 p-4">
      <header className="space-y-1">
        <h3 className="text-sm font-semibold text-gray-100">Review this memory proposal</h3>
        <p className="text-sm text-gray-200">
          Ozymandias wants to remember: <span className="font-semibold">{sentence}</span>
        </p>
      </header>

      <div className="grid gap-2 text-sm md:grid-cols-2">
        <div className="rounded bg-gray-900/40 px-3 py-2">
          <p className="mb-1 text-xs text-gray-400">Where this will be stored</p>
          <p className="text-gray-100">{laneLabel} memory</p>
        </div>
        <div className="rounded bg-gray-900/40 px-3 py-2">
          <p className="mb-1 text-xs text-gray-400">Sensitivity</p>
          <SensitivityChip sensitivity={proposed.sensitivity} />
        </div>
        <div className="rounded bg-gray-900/40 px-3 py-2 md:col-span-2">
          <p className="mb-1 text-xs text-gray-400">Where it came from</p>
          <p className="text-gray-100">
            {sourceLabel}
            {proposal.source_ref ? <span className="text-gray-400"> (ref: {proposal.source_ref})</span> : null}
          </p>
        </div>
      </div>

      {isPending ? (
        <div className="space-y-1 rounded border border-gray-700 bg-gray-900/30 p-3 text-xs text-gray-300">
          <p>
            <span className="font-semibold text-emerald-300">Approving</span> turns this into a confirmed memory,
            visible in Memory.
          </p>
          <p>
            <span className="font-semibold text-red-300">Rejecting</span> discards it. Nothing is stored.
          </p>
        </div>
      ) : (
        <div className="space-y-1 rounded border border-gray-700 bg-gray-900/30 p-3 text-xs text-gray-300">
          <p className="flex flex-wrap items-center gap-2">
            Decision:{" "}
            <span className="font-semibold text-gray-100">{labelFor(PROPOSAL_STATUS_LABELS, proposal.status)}</span>
            {decidedByAuto ? (
              <span className="rounded bg-blue-900/50 px-2 py-0.5 text-xs text-blue-100">Auto</span>
            ) : null}
          </p>
          {proposal.decided_at ? <p>Decided {toRelativeTime(proposal.decided_at)}.</p> : null}
          {proposal.rejection_reason ? <p>Reason: {proposal.rejection_reason}</p> : null}
        </div>
      )}

      <details className="text-xs text-gray-400">
        <summary className="cursor-pointer select-none text-gray-300">Technical details</summary>
        <div className="mt-2 grid gap-1 md:grid-cols-2">
          <p>
            <span className="text-gray-500">subject:</span> {proposed.subject}
          </p>
          <p>
            <span className="text-gray-500">attribute:</span> {toText(proposed.attribute)}
          </p>
          <p>
            <span className="text-gray-500">value:</span> {proposed.value}
          </p>
          <p>
            <span className="text-gray-500">memory_type:</span> {proposed.memory_type}
          </p>
          <p>
            <span className="text-gray-500">confidence:</span> {proposed.confidence}
          </p>
          <p>
            <span className="text-gray-500">source_type:</span> {proposed.source_type}
          </p>
          <p>
            <span className="text-gray-500">created_at:</span> {toText(proposal.created_at)}
          </p>
          <p>
            <span className="text-gray-500">decided_at:</span> {toText(proposal.decided_at)}
          </p>
          <p>
            <span className="text-gray-500">decided_by:</span> {toText(proposal.decided_by)}
          </p>
        </div>
      </details>
    </section>
  );
}

export default ProposalDetail;
