import AuditEntry from "@/components/audit/AuditEntry";
import AuditFilters from "@/components/audit/AuditFilters";
import AuditPagination from "@/components/audit/AuditPagination";
import Spinner from "@/components/common/Spinner";
import { useAudit } from "@/hooks/useAudit";

function AuditFeed(): JSX.Element {
  const {
    entries,
    total,
    loading,
    error,
    filters,
    page,
    limit,
    showS4,
    setFilters,
    resetFilters,
    setPage,
    setLimit,
    setShowS4,
  } = useAudit();

  return (
    <section className="space-y-4">
      <AuditFilters
        filters={filters}
        onChange={setFilters}
        onReset={resetFilters}
        showS4={showS4}
        onShowS4Change={setShowS4}
      />

      {loading ? (
        <div className="glass-card flex justify-center p-6">
          <Spinner />
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      {!loading && entries.length === 0 ? (
        <p className="glass-card p-4 text-sm text-gray-400">Keine Audit-Eintraege</p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <AuditEntry key={entry.audit_id} entry={entry} />
          ))}
        </div>
      )}

      <AuditPagination
        page={page}
        total={total}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={setLimit}
      />
    </section>
  );
}

export default AuditFeed;
