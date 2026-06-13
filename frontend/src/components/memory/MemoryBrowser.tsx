import Spinner from "@/components/common/Spinner";
import Toast from "@/components/common/Toast";
import ClaimCard from "@/components/memory/ClaimCard";
import ClaimDetail from "@/components/memory/ClaimDetail";
import ClaimFilters from "@/components/memory/ClaimFilters";
import { useClaims } from "@/hooks/useClaims";

function MemoryBrowser(): JSX.Element {
  const {
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
  } = useClaims();

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <input
          aria-label="memory-search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Suche nach Subject oder Value"
          className="w-full rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100"
        />
      </div>

      <ClaimFilters filters={filters} onChange={setFilters} onReset={resetFilters} />

      {toast ? (
        <div onAnimationEnd={clearToast}>
          <Toast message={toast.message} type={toast.type} timeoutMs={3200} />
        </div>
      ) : null}

      {loading ? (
        <div className="glass-card flex items-center justify-center p-6">
          <Spinner />
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      {!loading && filteredClaims.length === 0 ? (
        <p className="glass-card p-4 text-sm text-gray-400">Keine Claims gefunden.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-[3fr_2fr]">
          <div className="grid auto-rows-min gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filteredClaims.map((claim) => (
              <ClaimCard
                key={claim.claim_id}
                claim={claim}
                isSelected={selectedClaim?.claim_id === claim.claim_id}
                onSelect={(item) => void selectClaim(item)}
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
                onConfirm={confirmClaim}
                onRetract={retractClaim}
                onArchive={archiveClaim}
                onLock={lockClaim}
                onUnlock={unlockClaim}
                onSensitivityChange={updateSensitivity}
              />
            )
          ) : (
            <div className="glass-card h-fit p-4 text-sm text-gray-400">Waehle einen Claim fuer Details.</div>
          )}
        </div>
      )}
    </section>
  );
}

export default MemoryBrowser;
