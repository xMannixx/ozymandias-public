type ConflictGroupProps = {
  conflictGroupId?: string | null;
};

function ConflictGroup({ conflictGroupId }: ConflictGroupProps): JSX.Element | null {
  if (!conflictGroupId) {
    return null;
  }

  return (
    <div
      className="rounded border border-orange-500 bg-orange-900/20 px-3 py-2 text-sm text-orange-100"
      title="Dieser Claim ist Teil einer Konfliktgruppe."
    >
      Konfliktgruppe aktiv: {conflictGroupId}
    </div>
  );
}

export default ConflictGroup;
