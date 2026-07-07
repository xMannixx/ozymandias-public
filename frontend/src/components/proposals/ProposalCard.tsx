import ProposalActions from "@/components/proposals/ProposalActions";
import SensitivityChip from "@/components/common/SensitivityChip";
import { MEMORY_TYPE_LABELS } from "@/constants/memoryTypes";
import { claimSentence } from "@/lib/claimText";
import { toRelativeTime } from "@/lib/relativeTime";
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
  const sentence = claimSentence(proposed_claim);
  const laneLabel = MEMORY_TYPE_LABELS[proposed_claim.memory_type] ?? proposed_claim.memory_type;

  return (
    <article className={`glass-card space-y-2 p-3 ${selectedClass}`.trim()}>
      <button type="button" className="w-full text-left" onClick={() => onSelect(proposal)}>
        <p className="mb-2 text-sm text-gray-100">
          Ozymandias wants to remember: <span className="font-semibold">{sentence}</span>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <SensitivityChip sensitivity={proposed_claim.sensitivity} />
          <span className="rounded bg-gray-800 px-2 py-0.5 text-xs text-gray-300">{laneLabel}</span>
          {proposal.status === "auto_confirmed" ? (
            <span className="rounded bg-blue-900/50 px-2 py-0.5 text-xs text-blue-100">Auto</span>
          ) : null}
          <span className="ml-auto text-xs text-gray-500">{toRelativeTime(proposal.created_at)}</span>
        </div>
      </button>

      <ProposalActions proposal={proposal} onApprove={onApprove} onReject={onReject} />
    </article>
  );
}

export default ProposalCard;
