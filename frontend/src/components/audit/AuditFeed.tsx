import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
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
  const [searchParams, setSearchParams] = useSearchParams();
  const sourceRefFilter = searchParams.get("source_ref");

  const visibleEntries = useMemo(() => {
    let list = entries;
    if (category !== "all") {
      list = list.filter((entry) => categoryForEventType(entry.event_type) === category);
    }
    if (sourceRefFilter) {
      list = list.filter((entry) => entry.source_ref === sourceRefFilter);
    }
    return list;
  }, [entries, category, sourceRefFilter]);

  const dayGroups = useMemo(() => groupByDay(visibleEntries), [visibleEntries]);

  function clearSourceRefFilter(): void {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("source_ref");
      return next;
    });
  }

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

      {sourceRefFilter ? (
        <div className="glass-card flex items-center justify-between gap-2 p-2 text-sm text-blue-100">
          <span>
            Filtered by source: <span className="font-semibold">{sourceRefFilter}</span>
          </span>
          <button
            type="button"
            onClick={clearSourceRefFilter}
            className="rounded border border-blue-500/40 px-2 py-1 text-xs hover:bg-blue-900/40"
          >
            Clear
          </button>
        </div>
      ) : null}

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
