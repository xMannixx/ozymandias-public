import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError } from "@/api/client";
import { approveProposal, listProposals, rejectProposal } from "@/api/proposals";
import type { ProposalResponse } from "@/api/types";

export type ProposalTab = "pending" | "confirmed" | "rejected";

export type ProposalsToast = {
  message: string;
  type: "success" | "error" | "info";
};

type UseProposalsResult = {
  proposals: ProposalResponse[];
  visibleProposals: ProposalResponse[];
  loading: boolean;
  error: string | null;
  activeTab: ProposalTab;
  counts: Record<ProposalTab, number>;
  toast: ProposalsToast | null;
  setActiveTab: (tab: ProposalTab) => void;
  approve: (id: string) => Promise<void>;
  reject: (id: string, reason?: string) => Promise<void>;
  clearToast: () => void;
  refetch: () => Promise<void>;
};

function normalizeError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown error";
}

function isConflict(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === 409;
}

function filterByTab(proposals: ProposalResponse[], tab: ProposalTab): ProposalResponse[] {
  if (tab === "pending") {
    return proposals.filter((proposal) => proposal.status === "pending");
  }
  if (tab === "rejected") {
    return proposals.filter((proposal) => proposal.status === "rejected");
  }
  return proposals.filter((proposal) => proposal.status === "confirmed" || proposal.status === "auto_confirmed");
}

export function useProposals(): UseProposalsResult {
  const [proposals, setProposals] = useState<ProposalResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ProposalTab>("pending");
  const [toast, setToast] = useState<ProposalsToast | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listProposals();
      if (!Array.isArray(data)) {
        throw new Error("Invalid proposals response from server");
      }
      setProposals(data);
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const visibleProposals = useMemo(() => filterByTab(proposals, activeTab), [proposals, activeTab]);

  const counts = useMemo<Record<ProposalTab, number>>(
    () => ({
      pending: proposals.filter((proposal) => proposal.status === "pending").length,
      confirmed: proposals.filter(
        (proposal) => proposal.status === "confirmed" || proposal.status === "auto_confirmed",
      ).length,
      rejected: proposals.filter((proposal) => proposal.status === "rejected").length,
    }),
    [proposals],
  );

  const approve = useCallback(async (id: string) => {
    try {
      const updated = await approveProposal(id);
      setProposals((prev) => prev.map((proposal) => (proposal.proposal_id === updated.proposal_id ? updated : proposal)));
      setToast({ type: "success", message: "Approved. This is now a confirmed memory." });
    } catch (err) {
      const message = normalizeError(err);
      setToast({ type: "error", message: isConflict(err) ? `Conflict: ${message}` : message });
    }
  }, []);

  const reject = useCallback(async (id: string, reason?: string) => {
    try {
      const updated = await rejectProposal(id, reason);
      setProposals((prev) => prev.map((proposal) => (proposal.proposal_id === updated.proposal_id ? updated : proposal)));
      setToast({ type: "success", message: "Rejected. Nothing was stored." });
    } catch (err) {
      const message = normalizeError(err);
      setToast({ type: "error", message: isConflict(err) ? `Conflict: ${message}` : message });
    }
  }, []);

  const clearToast = useCallback(() => {
    setToast(null);
  }, []);

  return {
    proposals,
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
    refetch,
  };
}
