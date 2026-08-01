import { Archive, Copy, HelpCircle, Lock } from "lucide-react";
import SensitivityChip from "@/components/common/SensitivityChip";
import Tooltip from "@/components/common/Tooltip";
import { MEMORY_TYPE_LABELS } from "@/constants/memoryTypes";
import { claimSentence } from "@/lib/claimText";
import { confidenceDescription, confidenceLabel, labelFor, SOURCE_TYPE_LABELS } from "@/lib/labels";
import { toRelativeTime } from "@/lib/relativeTime";
import type { ClaimResponse } from "@/api/types";

type ClaimCardProps = {
  claim: ClaimResponse;
  isSelected: boolean;
  onSelect: (claim: ClaimResponse) => void;
  hasConflict?: boolean;
};

type CardBadgeProps = {
  icon: JSX.Element;
  label: string;
  tone: "warning" | "danger" | "neutral" | "info";
  ariaLabel?: string;
};

const badgeTone: Record<CardBadgeProps["tone"], string> = {
  warning: "border-amber-500/30 bg-amber-500/[0.10] text-amber-200",
  danger: "border-rose-500/30 bg-rose-500/[0.10] text-rose-200",
  info: "border-sky-500/25 bg-sky-500/[0.10] text-sky-200",
  neutral: "border-white/10 bg-white/[0.04] text-zinc-400",
};

function CardBadge({ icon, label, tone, ariaLabel }: CardBadgeProps): JSX.Element {
  return (
    <span
      aria-label={ariaLabel}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${badgeTone[tone]}`}
    >
      {icon}
      {label}
    </span>
  );
}

function ClaimCard({ claim, isSelected, onSelect, hasConflict = false }: ClaimCardProps): JSX.Element {
  const confidencePercent = Math.max(0, Math.min(100, Math.round(claim.confidence * 100)));
  const selectedClass = isSelected
    ? "neon-glow-blue border-[color:var(--accent)]/40 bg-white/[0.045]"
    : "border-white/[0.07] hover:border-white/[0.14] hover:bg-white/[0.03]";
  const reviewDueClass = claim.review_due ? "border-yellow-500" : "";
  const sentence = claimSentence(claim);
  const needsReview = claim.verification_state === "tentative";
  const typeLabel = MEMORY_TYPE_LABELS[claim.memory_type.toLowerCase()] ?? claim.memory_type;
  const sourceLabel = labelFor(SOURCE_TYPE_LABELS, claim.source_type);
  const isArchived = claim.lifecycle === "archived";

  return (
    <button
      type="button"
      onClick={() => onSelect(claim)}
      className={`group flex w-full flex-col gap-3 rounded-xl border bg-[color:var(--surface)] p-3.5 text-left transition ${selectedClass} ${reviewDueClass}`.trim()}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className={`line-clamp-2 text-sm font-medium leading-snug ${isArchived ? "text-zinc-400" : "text-white"}`}>
          {sentence}
        </h3>
        <span className="shrink-0 text-[11px] text-zinc-500">{toRelativeTime(claim.created_at)}</span>
      </div>

      {needsReview || hasConflict || claim.user_locked || isArchived ? (
        <div className="flex flex-wrap gap-1.5">
          {needsReview ? (
            <CardBadge
              tone="warning"
              icon={<HelpCircle className="h-3 w-3" aria-hidden="true" />}
              label="Needs review"
            />
          ) : null}
          {hasConflict ? (
            <CardBadge tone="danger" icon={<Copy className="h-3 w-3" aria-hidden="true" />} label="Possible duplicate" />
          ) : null}
          {claim.user_locked ? (
            <CardBadge
              tone="info"
              ariaLabel="locked-claim"
              icon={<Lock className="h-3 w-3" aria-hidden="true" />}
              label="Locked"
            />
          ) : null}
          {isArchived ? (
            <CardBadge tone="neutral" icon={<Archive className="h-3 w-3" aria-hidden="true" />} label="Archived" />
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-t border-white/[0.05] pt-2.5 text-[11px] text-zinc-500">
        <SensitivityChip sensitivity={claim.sensitivity} />
        <span className="text-zinc-500">{typeLabel}</span>
        <span aria-hidden="true" className="text-zinc-700">
          ·
        </span>
        <span className="truncate">{sourceLabel}</span>
        <Tooltip content={confidenceDescription(claim.confidence)}>
          <span
            tabIndex={0}
            className="ml-auto cursor-default whitespace-nowrap rounded-full border border-white/[0.07] bg-white/[0.03] px-2 py-0.5 text-[11px] text-zinc-400"
          >
            {`${confidenceLabel(claim.confidence)} · ${confidencePercent}%`}
          </span>
        </Tooltip>
      </div>
    </button>
  );
}

export default ClaimCard;
