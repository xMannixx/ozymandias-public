import Badge from "@/components/common/Badge";
import type { ClaimResponse } from "@/api/types";

type ClaimCardProps = {
  claim: ClaimResponse;
  isSelected: boolean;
  onSelect: (claim: ClaimResponse) => void;
};

const lifecycleIcon: Record<string, string> = {
  session: "S",
  temporary: "T",
  permanent: "P",
  expiry: "E",
  archived: "A",
};

function ClaimCard({ claim, isSelected, onSelect }: ClaimCardProps): JSX.Element {
  const confidencePercent = Math.max(0, Math.min(100, Math.round(claim.confidence * 100)));
  const selectedClass = isSelected ? "neon-glow-blue" : "";
  const reviewDueClass = claim.review_due ? "border-yellow-500" : "";

  return (
    <button
      type="button"
      onClick={() => onSelect(claim)}
      className={`glass-card w-full cursor-pointer p-3 text-left transition hover:border-blue-400 ${selectedClass} ${reviewDueClass}`.trim()}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-100">{claim.subject}</h3>
        <span className="rounded border border-gray-700 px-2 py-0.5 text-xs text-gray-300">
          {lifecycleIcon[claim.lifecycle.toLowerCase()] ?? "?"}
        </span>
      </div>

      <p className="mb-2 text-sm text-gray-300 line-clamp-2">{claim.value}</p>

      <div className="mb-2 flex items-center gap-2">
        <Badge sensitivity={claim.sensitivity} />
        <span className="rounded bg-gray-800 px-2 py-0.5 text-xs text-gray-300">{claim.trust_level}</span>
        {claim.user_locked ? (
          <span aria-label="locked-claim" className="rounded bg-purple-900/60 px-2 py-0.5 text-xs text-purple-200">
            Locked
          </span>
        ) : null}
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
