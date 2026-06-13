import Badge from "@/components/common/Badge";
import ProposalActions from "@/components/proposals/ProposalActions";
import { MEMORY_TYPE_LABELS } from "@/constants/memoryTypes";
import type { ProposalResponse } from "@/api/types";

type ProposalCardProps = {
  proposal: ProposalResponse;
  isSelected: boolean;
  onSelect: (proposal: ProposalResponse) => void;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string, reason?: string) => Promise<void>;
};

function ProposalCard({ proposal, isSelected, onSelect, onApprove, onReject }: ProposalCardProps): JSX.Element {
  const selectedClass = isSelected ? "neon-glow-blue" : "";
  const { proposed_claim } = proposal;

  return (
    <article className={`glass-card space-y-2 p-3 ${selectedClass}`.trim()}>
      <button type="button" className="w-full text-left" onClick={() => onSelect(proposal)}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-100">{proposed_claim.subject}</h3>
          <span className="rounded bg-gray-800 px-2 py-0.5 text-xs text-gray-200">{proposal.status}</span>
        </div>
        <p className="mb-2 text-sm text-gray-300">{proposed_claim.value}</p>
        <div className="flex items-center gap-2">
          <Badge sensitivity={proposed_claim.sensitivity} />
          <span className="text-xs text-gray-400">
            {MEMORY_TYPE_LABELS[proposed_claim.memory_type] ?? proposed_claim.memory_type}
          </span>
          {proposal.status === "auto_confirmed" ? (
            <span className="rounded bg-blue-900/50 px-2 py-0.5 text-xs text-blue-100">Auto</span>
          ) : null}
        </div>
      </button>

      <ProposalActions proposal={proposal} onApprove={onApprove} onReject={onReject} />
    </article>
  );
}

export default ProposalCard;
