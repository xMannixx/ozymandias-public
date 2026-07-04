import { useMemo, useState } from "react";
import AuditEntry from "@/components/audit/AuditEntry";
import AuditFilters from "@/components/audit/AuditFilters";
import AuditPagination from "@/components/audit/AuditPagination";
import Spinner from "@/components/common/Spinner";
import { useAudit } from "@/hooks/useAudit";
import { categoryForEventType, type AuditCategory } from "@/lib/labels";
import { groupByDay } from "@/lib/dayGroups";

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
  const [category, setCategory] = useState<AuditCategory | "all">("all");

  const visibleEntries = useMemo(
    () => (category === "all" ? entries : entries.filter((entry) => categoryForEventType(entry.event_type) === category)),
    [entries, category],
  );

  const dayGroups = useMemo(() => groupByDay(visibleEntries), [visibleEntries]);

  return (
    <section className="space-y-4">
      <AuditFilters
        filters={filters}
        onChange={setFilters}
        onReset={() => {
          resetFilters();
          setCategory("all");
        }}
        showS4={showS4}
        onShowS4Change={setShowS4}
        category={category}
        onCategoryChange={setCategory}
      />

      {loading ? (
        <div className="glass-card flex justify-center p-6">
          <Spinner />
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      {!loading && visibleEntries.length === 0 ? (
        <p className="glass-card p-4 text-sm text-gray-400">No audit entries match these filters.</p>
      ) : (
        <div className="space-y-4">
          {dayGroups.map((group) => (
            <div key={group.key} className="space-y-2">
              <h3 className="sticky top-0 z-10 rounded bg-gray-950/80 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                {group.label}
              </h3>
              <div className="space-y-2">
                {group.items.map((entry) => (
                  <AuditEntry key={entry.audit_id} entry={entry} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <AuditPagination page={page} total={total} limit={limit} onPageChange={setPage} onLimitChange={setLimit} />
    </section>
  );
}

export default AuditFeed;
