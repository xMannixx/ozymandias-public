import { Link } from "react-router-dom";
import ClaimActions from "@/components/memory/ClaimActions";
import ClaimVersionTimeline from "@/components/memory/ClaimVersionTimeline";
import ConflictGroup from "@/components/memory/ConflictGroup";
import S4Guard from "@/components/memory/S4Guard";
import InfoHint from "@/components/common/InfoHint";
import SensitivityChip from "@/components/common/SensitivityChip";
import { MEMORY_TYPE_LABELS } from "@/constants/memoryTypes";
import { claimSentence } from "@/lib/claimText";
import { claimStatusSentence, labelFor, SOURCE_TYPE_LABELS, TRUST_DESCRIPTIONS, TRUST_LABELS } from "@/lib/labels";
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
};

function toText(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  return String(value);
}

function FieldGroup({ title, fields }: { title: string; fields: Field[] }): JSX.Element {
  return (
    <section>
      <h4 className="mb-2 text-xs uppercase tracking-wide text-gray-400">{title}</h4>
      <dl className="grid gap-1 text-sm md:grid-cols-2">
        {fields.map((field) => (
          <div key={field.label} className="rounded bg-gray-900/40 px-2 py-1">
            <dt className="text-xs text-gray-400">{field.label}</dt>
            <dd className="text-gray-200">{field.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function TimestampLine({ label, value }: { label: string; value: string | null }): JSX.Element | null {
  if (!value) {
    return null;
  }
  return (
    <p className="text-xs text-gray-400">
      {label}: <span className="text-gray-200">{toRelativeTime(value)}</span>{" "}
      <span className="text-gray-500">({new Date(value).toLocaleString()})</span>
    </p>
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

  const coreFields: Field[] = [
    { label: "claim_id", value: claim.claim_id },
    { label: "subject", value: claim.subject },
    { label: "attribute", value: toText(claim.attribute) },
    { label: "value", value: claim.value },
    { label: "content", value: claim.content },
    { label: "memory_type", value: claim.memory_type },
  ];

  const classificationFields: Field[] = [
    { label: "sensitivity", value: claim.sensitivity },
    { label: "trust_level", value: claim.trust_level },
    { label: "handling_policy", value: claim.handling_policy },
    { label: "confidence", value: claim.confidence.toFixed(2) },
    { label: "source_type", value: claim.source_type },
    { label: "source_ref", value: toText(claim.source_ref) },
  ];

  const statusFields: Field[] = [
    { label: "verification_state", value: claim.verification_state },
    { label: "lifecycle", value: claim.lifecycle },
    { label: "user_locked", value: String(claim.user_locked) },
    { label: "decay_eligible", value: String(claim.decay_eligible) },
    { label: "review_due", value: String(claim.review_due) },
  ];

  const timestampFields: Field[] = [
    { label: "valid_from", value: toText(claim.valid_from) },
    { label: "valid_to", value: toText(claim.valid_to) },
    { label: "superseded_at", value: toText(claim.superseded_at) },
    { label: "last_reviewed", value: toText(claim.last_reviewed) },
    { label: "last_accessed", value: toText(claim.last_accessed) },
    { label: "created_at", value: toText(claim.created_at) },
    { label: "updated_at", value: toText(claim.updated_at) },
  ];

  return (
    <article className="glass-card space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <SensitivityChip sensitivity={claim.sensitivity} />
        <span className="flex items-center gap-1 rounded bg-gray-800 px-2 py-0.5 text-xs text-gray-300">
          {labelFor(TRUST_LABELS, claim.trust_level)}
          <InfoHint
            text={TRUST_DESCRIPTIONS[claim.trust_level] ?? "Trust level of this memory's source."}
            label="What does this trust level mean?"
          />
        </span>
        <span className="rounded bg-gray-800 px-2 py-0.5 text-xs text-gray-300">{laneLabel}</span>
      </div>

      <p className="flex flex-wrap items-center gap-1 text-sm text-gray-300">
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
        <div className="space-y-3">
          <p className="text-base font-semibold text-gray-100">{sentence}</p>
          <p className="text-xs text-gray-500">
            Source: {labelFor(SOURCE_TYPE_LABELS, claim.source_type)}
            {claim.source_ref ? (
              <>
                {" - "}
                <Link
                  to={`/audit?source_ref=${encodeURIComponent(claim.source_ref)}`}
                  className="text-blue-300 underline hover:text-blue-200"
                >
                  View related audit entries
                </Link>
              </>
            ) : null}
          </p>
          <div className="space-y-0.5">
            <TimestampLine label="Created" value={claim.created_at} />
            <TimestampLine label="Last updated" value={claim.updated_at} />
            <TimestampLine label="Last reviewed" value={claim.last_reviewed} />
          </div>

          <details>
            <summary className="cursor-pointer select-none text-xs text-gray-300">Technical details</summary>
            <div className="mt-2 space-y-3">
              <FieldGroup title="Core" fields={coreFields} />
              <FieldGroup title="Classification" fields={classificationFields} />
              <FieldGroup title="Status" fields={statusFields} />
              <FieldGroup title="Timestamps" fields={timestampFields} />
            </div>
          </details>
        </div>
      </S4Guard>

      <ClaimVersionTimeline versions={versions} />
    </article>
  );
}

export default ClaimDetail;
