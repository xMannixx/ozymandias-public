import ClaimActions from "@/components/memory/ClaimActions";
import ClaimVersionTimeline from "@/components/memory/ClaimVersionTimeline";
import ConflictGroup from "@/components/memory/ConflictGroup";
import S4Guard from "@/components/memory/S4Guard";
import { MEMORY_TYPE_LABELS } from "@/constants/memoryTypes";
import type { ClaimResponse, ClaimVersionResponse, Sensitivity } from "@/api/types";

type ClaimDetailProps = {
  claim: ClaimResponse;
  versions: ClaimVersionResponse[];
  conflictGroupId?: string | null;
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

function ClaimDetail({
  claim,
  versions,
  conflictGroupId,
  onConfirm,
  onRetract,
  onArchive,
  onLock,
  onUnlock,
  onSensitivityChange,
}: ClaimDetailProps): JSX.Element {
  const coreFields: Field[] = [
    { label: "claim_id", value: claim.claim_id },
    { label: "subject", value: claim.subject },
    { label: "attribute", value: toText(claim.attribute) },
    { label: "value", value: claim.value },
    { label: "content", value: claim.content },
    { label: "memory_type", value: MEMORY_TYPE_LABELS[claim.memory_type] ?? claim.memory_type },
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
      <ClaimActions
        claim={claim}
        onConfirm={onConfirm}
        onRetract={onRetract}
        onArchive={onArchive}
        onLock={onLock}
        onUnlock={onUnlock}
        onSensitivityChange={onSensitivityChange}
      />

      <ConflictGroup conflictGroupId={conflictGroupId} />

      <S4Guard isS4={claim.sensitivity === "S4"}>
        <FieldGroup title="Kern" fields={coreFields} />
        <FieldGroup title="Klassifikation" fields={classificationFields} />
        <FieldGroup title="Status" fields={statusFields} />
        <FieldGroup title="Zeitstempel" fields={timestampFields} />
      </S4Guard>

      <ClaimVersionTimeline versions={versions} />
    </article>
  );
}

export default ClaimDetail;
