import { AlertTriangle } from "lucide-react";

type ConflictGroupProps = {
  conflictGroupId?: string | null;
  relatedCount?: number;
};

function ConflictGroup({ conflictGroupId, relatedCount = 0 }: ConflictGroupProps): JSX.Element | null {
  if (!conflictGroupId) {
    return null;
  }

  return (
    <div
      className="flex gap-2.5 rounded-lg border border-amber-500/25 bg-amber-500/[0.07] px-3 py-2.5"
      title="This memory shares a subject with at least one other memory that has a different value."
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
      <div className="space-y-1">
        <p className="text-sm text-amber-100">
          {relatedCount > 1
            ? `${relatedCount} memories look like they conflict or duplicate each other.`
            : "This memory may conflict with another one."}
        </p>
        <p className="text-xs text-amber-200/70">
          To resolve: check both, then retract the one that&apos;s outdated or incorrect.
        </p>
      </div>
    </div>
  );
}

export default ConflictGroup;
