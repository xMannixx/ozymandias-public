import SensitivityChip from "@/components/common/SensitivityChip";
import { claimSentence } from "@/lib/claimText";
import { toRelativeTime } from "@/lib/relativeTime";
import type { ClaimResponse } from "@/api/types";

type ClaimCardProps = {
  claim: ClaimResponse;
  isSelected: boolean;
  onSelect: (claim: ClaimResponse) => void;
  hasConflict?: boolean;
};

function ClaimCard({ claim, isSelected, onSelect, hasConflict = false }: ClaimCardProps): JSX.Element {
  const confidencePercent = Math.max(0, Math.min(100, Math.round(claim.confidence * 100)));
  const selectedClass = isSelected ? "neon-glow-blue" : "";
  const reviewDueClass = claim.review_due ? "border-yellow-500" : "";
  const sentence = claimSentence(claim);
  const needsReview = claim.verification_state === "tentative";

  return (
    <button
      type="button"
      onClick={() => onSelect(claim)}
      className={`glass-card w-full cursor-pointer p-3 text-left transition hover:border-blue-400 ${selectedClass} ${reviewDueClass}`.trim()}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className="line-clamp-2 text-sm font-semibold text-gray-100">{sentence}</h3>
        {needsReview ? (
          <span className="shrink-0 rounded bg-yellow-900/50 px-2 py-0.5 text-xs text-yellow-200">
            Needs review
          </span>
        ) : null}
        {hasConflict ? (
          <span className="shrink-0 rounded bg-orange-900/50 px-2 py-0.5 text-xs text-orange-200">
            Possible duplicate
          </span>
        ) : null}
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-2">
        <SensitivityChip sensitivity={claim.sensitivity} />
        {claim.user_locked ? (
          <span aria-label="locked-claim" className="rounded bg-purple-900/60 px-2 py-0.5 text-xs text-purple-200">
            Locked
          </span>
        ) : null}
        {claim.lifecycle === "archived" ? (
          <span className="rounded bg-gray-800 px-2 py-0.5 text-xs text-gray-400">Archived</span>
        ) : null}
        <span className="ml-auto text-xs text-gray-500">{toRelativeTime(claim.created_at)}</span>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between text-xs text-gray-400">
          <span>Confidence</span>
          <span>{confidencePercent}%</span>
        </div>
        <div className="h-1.5 w-full rounded bg-gray-800">
          <div className="h-full rounded bg-blue-500" style={{ width: `${confidencePercent}%` }} />
        </div>
      </div>
    </button>
  );
}

export default ClaimCard;
