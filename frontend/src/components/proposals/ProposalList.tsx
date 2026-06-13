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

function ProposalList(): JSX.Element {
  const {
    visibleProposals,
    loading,
    error,
    activeTab,
    counts,
    toast,
    setActiveTab,
    approve,
    reject,
    clearToast,
  } = useProposals();
  const [selectedProposal, setSelectedProposal] = useState<ProposalResponse | null>(null);

  return (
    <section className="space-y-4">
      <div className="glass-card flex flex-wrap items-center gap-2 p-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
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

      {loading ? (
        <div className="glass-card flex justify-center p-6">
          <Spinner />
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      {!loading && visibleProposals.length === 0 ? (
        <p className="glass-card p-4 text-sm text-gray-400">Keine Proposals in diesem Tab.</p>
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
            <div className="glass-card h-fit p-4 text-sm text-gray-400">Waehle ein Proposal fuer Details.</div>
          )}
        </div>
      )}
    </section>
  );
}

export default ProposalList;
