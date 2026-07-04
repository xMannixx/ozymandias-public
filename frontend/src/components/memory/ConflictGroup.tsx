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
      className="rounded border border-orange-500 bg-orange-900/20 px-3 py-2 text-sm text-orange-100"
      title="This memory shares a subject with at least one other memory that has a different value."
    >
      <p>
        {relatedCount > 1
          ? `${relatedCount} memories look like they conflict or duplicate each other.`
          : "This memory may conflict with another one."}
      </p>
      <p className="mt-1 text-xs text-orange-200/80">
        To resolve: check both, then retract the one that&apos;s outdated or incorrect.
      </p>
    </div>
  );
}

export default ConflictGroup;
