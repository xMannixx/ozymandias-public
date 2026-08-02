import { ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import ClaimActions from "@/components/memory/ClaimActions";
import ClaimVersionTimeline from "@/components/memory/ClaimVersionTimeline";
import ConflictGroup from "@/components/memory/ConflictGroup";
import S4Guard from "@/components/memory/S4Guard";
import InfoHint from "@/components/common/InfoHint";
import SensitivityChip from "@/components/common/SensitivityChip";
import { MEMORY_TYPE_LABELS } from "@/constants/memoryTypes";
import { claimSentence } from "@/lib/claimText";
import {
  claimStatusSentence,
  codeWithLabel,
  confidenceDescription,
  confidenceLabel,
  HANDLING_POLICY_DESCRIPTIONS,
  HANDLING_POLICY_LABELS,
  labelFor,
  LIFECYCLE_DESCRIPTIONS,
  LIFECYCLE_LABELS,
  SENSITIVITY_LABELS,
  SOURCE_TYPE_LABELS,
  TRUST_DESCRIPTIONS,
  TRUST_LABELS,
  VERIFICATION_DESCRIPTIONS,
  VERIFICATION_LABELS,
} from "@/lib/labels";
import { toRelativeTime } from "@/lib/relativeTime";
import type { ClaimResponse, ClaimVersionResponse, Sensitivity } from "@/api/types";

type ClaimDetailProps = {
  claim: ClaimResponse;
  versions: ClaimVersionResponse[];
  conflictGroupId?: string | null;
  conflictRelatedCount?: number;
  onConfirm: (id: string) => Promise<void>;
  onRetract: (id: string) => Promise<void>;
  onArchive: (id: string) => Promise<void>;
  onLock: (id: string) => Promise<void>;
  onUnlock: (id: string) => Promise<void>;
  onSensitivityChange: (id: string, sensitivity: Sensitivity) => Promise<void>;
};

type Field = {
  label: string;
  value: string;
  /** Original database column, kept so power users can still map a field back. */
  raw?: string;
  mono?: boolean;
};

function toText(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "Not set";
  }
  return String(value);
}

function yesNo(value: boolean): string {
  return value ? "Yes" : "No";
}

function toDateText(value: string | null): string {
  if (!value) {
    return "Not set";
  }
  return `${toRelativeTime(value)} (${new Date(value).toLocaleString()})`;
}

function FieldGroup({ title, fields }: { title: string; fields: Field[] }): JSX.Element {
  return (
    <section>
      <h4 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-zinc-500">{title}</h4>
      <dl className="grid gap-1.5 sm:grid-cols-2">
        {fields.map((field) => (
          <div key={field.label} className="rounded-lg border border-white/[0.05] bg-white/[0.02] px-2.5 py-1.5">
            <dt className="flex items-baseline gap-1.5 text-[11px] text-zinc-500">
              {field.label}
              {field.raw ? <span className="mono text-[10px] text-zinc-600">{field.raw}</span> : null}
            </dt>
            <dd className={`break-words text-xs text-zinc-200 ${field.mono ? "mono" : ""}`}>{field.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** One line of the "what this means" summary above the technical details. */
function SummaryRow({ label, value, hint }: { label: string; value: string; hint: string }): JSX.Element {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="flex shrink-0 items-center gap-1 text-xs text-zinc-500">
        {label}
        <InfoHint text={hint} label={`What does ${label} mean?`} />
      </span>
      <span className="text-right text-xs text-zinc-200">{value}</span>
    </div>
  );
}

function ClaimDetail({
  claim,
  versions,
  conflictGroupId,
  conflictRelatedCount,
  onConfirm,
  onRetract,
  onArchive,
  onLock,
  onUnlock,
  onSensitivityChange,
}: ClaimDetailProps): JSX.Element {
  const sentence = claimSentence(claim);
  const laneLabel = MEMORY_TYPE_LABELS[claim.memory_type.toLowerCase()] ?? claim.memory_type;
  const isS4 = claim.sensitivity === "S4";
  const confidencePercent = Math.round(claim.confidence * 100);

  const contentFields: Field[] = [
    { label: "Internal ID", value: claim.claim_id, raw: "claim_id", mono: true },
    { label: "About", value: claim.subject, raw: "subject" },
    { label: "Aspect", value: toText(claim.attribute), raw: "attribute" },
    { label: "Value", value: claim.value, raw: "value" },
    { label: "Full text", value: claim.content, raw: "content" },
    { label: "Category", value: laneLabel, raw: "memory_type" },
  ];

  const classificationFields: Field[] = [
    { label: "Privacy level", value: codeWithLabel(SENSITIVITY_LABELS, claim.sensitivity), raw: "sensitivity" },
    { label: "Source trust", value: codeWithLabel(TRUST_LABELS, claim.trust_level), raw: "trust_level" },
    { label: "Where it may be processed", value: labelFor(HANDLING_POLICY_LABELS, claim.handling_policy), raw: "handling_policy" },
    { label: "How sure Ozymandias is", value: `${confidenceLabel(claim.confidence)} (${confidencePercent}%)`, raw: "confidence" },
    { label: "Where it came from", value: labelFor(SOURCE_TYPE_LABELS, claim.source_type), raw: "source_type" },
    { label: "Source reference", value: toText(claim.source_ref), raw: "source_ref", mono: true },
  ];

  const statusFields: Field[] = [
    { label: "Verification", value: labelFor(VERIFICATION_LABELS, claim.verification_state), raw: "verification_state" },
    { label: "How long it is kept", value: labelFor(LIFECYCLE_LABELS, claim.lifecycle), raw: "lifecycle" },
    { label: "Locked by you", value: yesNo(claim.user_locked), raw: "user_locked" },
    { label: "May fade over time", value: yesNo(claim.decay_eligible), raw: "decay_eligible" },
    { label: "Due for a review", value: yesNo(claim.review_due), raw: "review_due" },
  ];

  const timestampFields: Field[] = [
    { label: "Valid from", value: toDateText(claim.valid_from), raw: "valid_from" },
    { label: "Valid until", value: toDateText(claim.valid_to), raw: "valid_to" },
    { label: "Replaced on", value: toDateText(claim.superseded_at), raw: "superseded_at" },
    { label: "Last reviewed", value: toDateText(claim.last_reviewed), raw: "last_reviewed" },
    { label: "Last used", value: toDateText(claim.last_accessed), raw: "last_accessed" },
    { label: "Created", value: toDateText(claim.created_at), raw: "created_at" },
    { label: "Updated", value: toDateText(claim.updated_at), raw: "updated_at" },
  ];

  return (
    <article className="space-y-4 rounded-xl border border-white/[0.07] bg-[color:var(--surface)] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <SensitivityChip sensitivity={claim.sensitivity} />
        <span className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-xs text-zinc-300">
          {labelFor(TRUST_LABELS, claim.trust_level)}
          <InfoHint
            text={TRUST_DESCRIPTIONS[claim.trust_level] ?? "Trust level of this memory's source."}
            label="What does this trust level mean?"
          />
        </span>
        <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-xs text-zinc-300">
          {laneLabel}
        </span>
      </div>

      <p className="flex flex-wrap items-center gap-1 text-sm text-zinc-400">
        {claimStatusSentence(claim)}
        <InfoHint
          text="Verification state, how long this memory is kept, and where it may be processed."
          label="What does this status mean?"
        />
      </p>

      <ClaimActions
        claim={claim}
        onConfirm={onConfirm}
        onRetract={onRetract}
        onArchive={onArchive}
        onLock={onLock}
        onUnlock={onUnlock}
        onSensitivityChange={onSensitivityChange}
      />

      <ConflictGroup conflictGroupId={conflictGroupId} relatedCount={conflictRelatedCount} />

      <S4Guard isS4={isS4}>
        <div className="space-y-4">
          <p className="text-base font-medium leading-snug text-white">{sentence}</p>

          <div className="divide-y divide-white/[0.05] rounded-lg border border-white/[0.06] bg-white/[0.015] px-3 py-1">
            <SummaryRow
              label="Status"
              value={labelFor(VERIFICATION_LABELS, claim.verification_state)}
              hint={VERIFICATION_DESCRIPTIONS[claim.verification_state] ?? "Whether you have confirmed this memory."}
            />
            <SummaryRow
              label="How sure Ozymandias is"
              value={`${confidenceLabel(claim.confidence)} (${confidencePercent}%)`}
              hint={confidenceDescription(claim.confidence)}
            />
            <SummaryRow
              label="Kept"
              value={labelFor(LIFECYCLE_LABELS, claim.lifecycle)}
              hint={LIFECYCLE_DESCRIPTIONS[claim.lifecycle] ?? "How long this memory is kept."}
            />
            <SummaryRow
              label="Processed"
              value={labelFor(HANDLING_POLICY_LABELS, claim.handling_policy)}
              hint={
                HANDLING_POLICY_DESCRIPTIONS[claim.handling_policy]
                ?? "Where this memory may be sent when Ozymandias answers you."
              }
            />
            <SummaryRow
              label="Where it came from"
              value={labelFor(SOURCE_TYPE_LABELS, claim.source_type)}
              hint="How this memory ended up here: you said it, you confirmed it, Ozymandias guessed it, or a connected service delivered it."
            />
          </div>

          {claim.source_ref ? (
            <p className="text-xs">
              <Link
                to={`/audit?source_ref=${encodeURIComponent(claim.source_ref)}`}
                className="inline-flex items-center gap-1 text-[color:var(--accent)] hover:underline"
              >
                View related audit entries
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </Link>
            </p>
          ) : null}

          <div className="space-y-0.5 text-xs text-zinc-500">
            <p>
              Created <span className="text-zinc-300">{toRelativeTime(claim.created_at)}</span>, last updated{" "}
              <span className="text-zinc-300">{toRelativeTime(claim.updated_at)}</span>
              {claim.last_reviewed ? (
                <>
                  , last reviewed <span className="text-zinc-300">{toRelativeTime(claim.last_reviewed)}</span>
                </>
              ) : null}
              .
            </p>
          </div>

          <details className="rounded-lg border border-white/[0.06]">
            <summary className="cursor-pointer select-none px-3 py-2 text-xs text-zinc-500 hover:text-zinc-300">
              Technical details
            </summary>
            <div className="space-y-3 border-t border-white/[0.06] p-3">
              <p className="text-[11px] text-zinc-600">
                Every stored field, with the database column name next to it.
              </p>
              <FieldGroup title="Content" fields={contentFields} />
              <FieldGroup title="Privacy and trust" fields={classificationFields} />
              <FieldGroup title="State" fields={statusFields} />
              <FieldGroup title="Dates" fields={timestampFields} />
            </div>
          </details>
        </div>
      </S4Guard>

      <ClaimVersionTimeline versions={versions} />
    </article>
  );
}

export default ClaimDetail;
