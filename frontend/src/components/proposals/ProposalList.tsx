import { useState } from "react";
import Spinner from "@/components/common/Spinner";
import Toast from "@/components/common/Toast";
import ProposalCard from "@/components/proposals/ProposalCard";
import ProposalDetail from "@/components/proposals/ProposalDetail";
import { useProposals, type ProposalTab } from "@/hooks/useProposals";
import type { ProposalResponse } from "@/api/types";

const tabs: { id: ProposalTab; label: string }[] = [
  { id: "pending", label: "Pending" },
  { id: "confirmed", label: "Confirmed" },
  { id: "rejected", label: "Rejected" },
];

const emptyStateByTab: Record<ProposalTab, string> = {
  pending: "Nothing waiting for review. New proposals from Ozymandias will show up here first.",
  confirmed: "No approved proposals yet.",
  rejected: "No rejected proposals yet.",
};

function ProposalList(): JSX.Element {
  const {
    visibleProposals,
    error,
    loadState,
    activeTab,
    counts,
    toast,
    setActiveTab,
    approve,
    reject,
    clearToast,
    refetch,
  } = useProposals();
  const [selectedProposal, setSelectedProposal] = useState<ProposalResponse | null>(null);

  return (
    <section className="space-y-4">
      <header className="glass-card space-y-1 p-3">
        <h2 className="text-lg font-semibold text-gray-100">Review Inbox</h2>
        <p className="text-sm text-gray-400">
          Proposals are things Ozymandias wants to remember about you. Nothing becomes a permanent memory until you
          approve it here - approving stores it in Memory, rejecting discards it.
        </p>
      </header>

      <div
        className="glass-card flex flex-wrap items-center gap-2 p-2"
        role="tablist"
        aria-label="Proposal status"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`rounded px-3 py-1 text-sm ${
              activeTab === tab.id ? "bg-blue-700/50 text-blue-100" : "text-gray-300 hover:bg-gray-800"
            }`}
          >
            {tab.label} ({counts[tab.id]})
          </button>
        ))}
      </div>

      {toast ? (
        <div onAnimationEnd={clearToast}>
          <Toast message={toast.message} type={toast.type} />
        </div>
      ) : null}

      {loadState === "loading" && visibleProposals.length === 0 ? (
        <div className="glass-card flex justify-center p-6" role="status" aria-live="polite">
          <Spinner />
        </div>
      ) : loadState === "error" ? (
        <div className="glass-card flex flex-col items-start gap-2 p-4" role="alert">
          <p className="text-sm text-red-300">
            Could not load proposals. {error ?? ""}
          </p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="rounded border border-blue-500/40 px-3 py-1 text-xs text-blue-200 hover:bg-blue-900/40"
          >
            Retry
          </button>
        </div>
      ) : visibleProposals.length === 0 ? (
        <p className="glass-card p-4 text-sm text-gray-400">{emptyStateByTab[activeTab]}</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-[3fr_2fr]">
          <div className="grid gap-3">
            {visibleProposals.map((proposal) => (
              <ProposalCard
                key={proposal.proposal_id}
                proposal={proposal}
                isSelected={selectedProposal?.proposal_id === proposal.proposal_id}
                onSelect={setSelectedProposal}
                onApprove={approve}
                onReject={reject}
              />
            ))}
          </div>

          {selectedProposal ? (
            <ProposalDetail proposal={selectedProposal} />
          ) : (
            <div className="glass-card h-fit p-4 text-sm text-gray-400">Select a proposal to see details.</div>
          )}
        </div>
      )}
    </section>
  );
}

export default ProposalList;
