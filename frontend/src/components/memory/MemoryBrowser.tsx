import { useEffect, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Brain, Search } from "lucide-react";
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

  const segmentCounts = useMemo(
    () => ({
      all: claims.filter((claim) => claim.lifecycle !== "archived").length,
      needs_review: claims.filter(
        (claim) => claim.verification_state === "tentative" && claim.lifecycle !== "archived",
      ).length,
      archived: claims.filter((claim) => claim.lifecycle === "archived").length,
    }),
    [claims],
  );

  return (
    <section className="space-y-5">
      <header className="space-y-3">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.03] text-[color:var(--accent)]"
          >
            <Brain className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-lg font-medium tracking-tight text-white">Memory</h2>
            <p className="mt-0.5 max-w-2xl text-sm text-zinc-500">
              Everything Ozymandias knows about you, and where each piece came from. Confirm what is right, retract
              what is wrong. Nothing here is saved without going through{" "}
              <Link to="/proposals" className="text-[color:var(--accent)] hover:underline">
                a proposal
              </Link>{" "}
              first.
            </p>
          </div>
        </div>

        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
          />
          <input
            aria-label="memory-search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search what Ozymandias remembers…"
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] py-2 pl-9 pr-3 text-sm text-zinc-100 placeholder:text-zinc-600"
          />
        </div>
      </header>

      <ClaimFilters
        filters={filters}
        onChange={setFilters}
        onReset={resetFilters}
        counts={segmentCounts}
      />

      {toast ? (
        <div onAnimationEnd={clearToast}>
          <Toast message={toast.message} type={toast.type} timeoutMs={3200} />
        </div>
      ) : null}

      {loading && claims.length === 0 ? (
        <div
          className="flex items-center justify-center rounded-xl border border-white/[0.07] bg-[color:var(--surface)] p-8"
          role="status"
          aria-live="polite"
        >
          <Spinner />
        </div>
      ) : error && claims.length === 0 ? (
        <div
          className="flex flex-col items-start gap-2 rounded-xl border border-rose-500/25 bg-rose-500/[0.06] p-4"
          role="alert"
        >
          <p className="text-sm text-rose-100">Could not load memories. {error}</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="rounded-lg border border-white/[0.1] px-3 py-1.5 text-xs text-zinc-200 transition hover:bg-white/[0.05]"
          >
            Try again
          </button>
        </div>
      ) : filteredClaims.length === 0 ? (
        <div className="rounded-xl border border-white/[0.07] bg-[color:var(--surface)] p-8 text-center">
          <p className="text-sm text-zinc-300">
            {claims.length === 0 ? "Nothing remembered yet" : "No memories match these filters"}
          </p>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-zinc-500">
            {claims.length === 0 ? (
              <>
                Talk to Ozymandias in{" "}
                <Link to="/chat" className="text-[color:var(--accent)] hover:underline">
                  Chat
                </Link>
                . When it picks up something worth keeping, it will ask you first — approved proposals show up here.
              </>
            ) : (
              "Try clearing the filters or searching for a different word."
            )}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-[3fr_2fr]">
          <div
            className={`grid auto-rows-min gap-3 sm:grid-cols-2 xl:grid-cols-3 ${
              selectedClaim ? "hidden md:grid" : ""
            }`}
          >
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
            <div className="space-y-2 md:sticky md:top-4 md:self-start">
              <button
                type="button"
                className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-white/[0.05] md:hidden"
                onClick={() => void selectClaim(null)}
              >
                ← Back to list
              </button>
              {versionsLoading ? (
                <div
                  className="flex items-center justify-center rounded-xl border border-white/[0.07] bg-[color:var(--surface)] p-8"
                  role="status"
                  aria-live="polite"
                >
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
              )}
            </div>
          ) : (
            <div className="hidden h-fit rounded-xl border border-dashed border-white/[0.08] p-6 text-center text-sm text-zinc-500 md:block">
              Pick a memory on the left to see where it came from and what you can do with it.
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default MemoryBrowser;
