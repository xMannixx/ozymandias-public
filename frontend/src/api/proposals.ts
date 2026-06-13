import { request } from "@/api/client";
import type { ProposalResponse } from "@/api/types";

type ListProposalsParams = {
  status?: string;
  limit?: number;
  offset?: number;
};

function buildQuery(params: ListProposalsParams | undefined): string {
  if (!params) {
    return "";
  }

  const searchParams = new URLSearchParams();
  if (params.status) {
    searchParams.set("status", params.status);
  }
  if (typeof params.limit === "number") {
    searchParams.set("limit", String(params.limit));
  }
  if (typeof params.offset === "number") {
    searchParams.set("offset", String(params.offset));
  }

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export function listProposals(params?: ListProposalsParams): Promise<ProposalResponse[]> {
  return request<ProposalResponse[]>(`/proposals${buildQuery(params)}`);
}

export function approveProposal(id: string): Promise<ProposalResponse> {
  return request<ProposalResponse>(`/proposals/${id}/approve`, {
    method: "POST",
  });
}

export function rejectProposal(id: string, reason?: string): Promise<ProposalResponse> {
  return request<ProposalResponse>(`/proposals/${id}/reject`, {
    method: "POST",
    body: reason ? { reason } : {},
  });
}
