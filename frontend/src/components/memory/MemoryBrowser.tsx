import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import Spinner from "@/components/common/Spinner";
import Toast from "@/components/common/Toast";
import ClaimCard from "@/components/memory/ClaimCard";
import ClaimDetail from "@/components/memory/ClaimDetail";
import ClaimFilters from "@/components/memory/ClaimFilters";
import { useClaims } from "@/hooks/useClaims";
import type { ClaimResponse } from "@/api/types";

type ConflictInfo = {
  key: string;
  count: number;
};

function conflictKeyFor(claim: ClaimResponse): string {
  return `${claim.subject.trim().toLowerCase()}|${(claim.attribute ?? "").trim().toLowerCase()}`;
}

/**
 * Client-side heuristic: claims that share the same subject/attribute but
 * disagree on the value are flagged as a possible conflict/duplicate. There
 * is no backend conflict_group_id on claims, so this stays purely visual.
 */
function buildConflictMap(claims: ClaimResponse[]): Map<string, ConflictInfo> {
  const byKey = new Map<string, ClaimResponse[]>();
  claims
    .filter((claim) => claim.lifecycle !== "archived" && claim.verification_state !== "retracted")
    .forEach((claim) => {
      const key = conflictKeyFor(claim);
      const list = byKey.get(key) ?? [];
      list.push(claim);
      byKey.set(key, list);
    });

  const result = new Map<string, ConflictInfo>();
  byKey.forEach((list, key) => {
    const distinctValues = new Set(list.map((claim) => claim.value.trim().toLowerCase()));
    if (list.length > 1 && distinctValues.size > 1) {
      list.forEach((claim) => result.set(claim.claim_id, { key, count: list.length }));
    }
  });
  return result;
}

function MemoryBrowser(): JSX.Element {
  const {
    claims,
    filteredClaims,
    loading,
    error,
    filters,
    searchQuery,
    selectedClaim,
    versions,
    versionsLoading,
    toast,
    setFilters,
    resetFilters,
    setSearchQuery,
    selectClaim,
    confirmClaim,
    retractClaim,
    archiveClaim,
    lockClaim,
    unlockClaim,
    updateSensitivity,
    clearToast,
    refetch,
  } = useClaims();

  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Applies the URL's search term, e.g. when arriving from a cross-link
    // such as "View in Memory" on a confirmed proposal.
    const searchFromUrl = searchParams.get("search");
    if (searchFromUrl) {
      setSearchQuery(searchFromUrl);
    }
  }, [searchParams, setSearchQuery]);

  const conflictMap = useMemo(() => buildConflictMap(claims), [claims]);
  const selectedConflict = selectedClaim ? conflictMap.get(selectedClaim.claim_id) : undefined;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <input
          aria-label="memory-search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search your memories"
          className="w-full rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100"
        />
      </div>

      <ClaimFilters filters={filters} onChange={setFilters} onReset={resetFilters} />

      {toast ? (
        <div onAnimationEnd={clearToast}>
          <Toast message={toast.message} type={toast.type} timeoutMs={3200} />
        </div>
      ) : null}

      {loading && claims.length === 0 ? (
        <div className="glass-card flex items-center justify-center p-6" role="status" aria-live="polite">
          <Spinner />
        </div>
      ) : error && claims.length === 0 ? (
        <div className="glass-card flex flex-col items-start gap-2 p-4" role="alert">
          <p className="text-sm text-red-300">Could not load memories. {error}</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="rounded border border-blue-500/40 px-3 py-1 text-xs text-blue-200 hover:bg-blue-900/40"
          >
            Retry
          </button>
        </div>
      ) : filteredClaims.length === 0 ? (
        <p className="glass-card p-4 text-sm text-gray-400">
          No memories match these filters yet. Memories appear here once you approve a proposal or Ozymandias
          confirms something automatically.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-[3fr_2fr]">
          <div className="grid auto-rows-min gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filteredClaims.map((claim) => (
              <ClaimCard
                key={claim.claim_id}
                claim={claim}
                isSelected={selectedClaim?.claim_id === claim.claim_id}
                onSelect={(item) => void selectClaim(item)}
                hasConflict={conflictMap.has(claim.claim_id)}
              />
            ))}
          </div>

          {selectedClaim ? (
            versionsLoading ? (
              <div className="glass-card flex items-center justify-center p-6">
                <Spinner />
              </div>
            ) : (
              <ClaimDetail
                claim={selectedClaim}
                versions={versions}
                conflictGroupId={selectedConflict?.key ?? null}
                conflictRelatedCount={selectedConflict?.count}
                onConfirm={confirmClaim}
                onRetract={retractClaim}
                onArchive={archiveClaim}
                onLock={lockClaim}
                onUnlock={unlockClaim}
                onSensitivityChange={updateSensitivity}
              />
            )
          ) : (
            <div className="glass-card h-fit p-4 text-sm text-gray-400">Select a memory to see details.</div>
          )}
        </div>
      )}
    </section>
  );
}

export default MemoryBrowser;
