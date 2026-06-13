import { request } from "@/api/client";
import type {
  ArchiveRetractResponse,
  ClaimResponse,
  ClaimVersionResponse,
  Sensitivity,
} from "@/api/types";

type ListClaimsParams = {
  subject?: string;
  sensitivity?: Sensitivity;
  limit?: number;
  offset?: number;
};

function buildQuery(params: ListClaimsParams | undefined): string {
  if (!params) {
    return "";
  }

  const searchParams = new URLSearchParams();
  if (params.subject) {
    searchParams.set("subject", params.subject);
  }
  if (params.sensitivity) {
    searchParams.set("sensitivity", params.sensitivity);
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

export function listClaims(params?: ListClaimsParams): Promise<ClaimResponse[]> {
  return request<ClaimResponse[]>(`/claims${buildQuery(params)}`);
}

export function getClaim(id: string): Promise<ClaimResponse> {
  return request<ClaimResponse>(`/claims/${id}`);
}

export function createClaim(claim: Partial<ClaimResponse>): Promise<ClaimResponse> {
  return request<ClaimResponse>("/claims", {
    method: "POST",
    body: claim as Record<string, unknown>,
  });
}

export function archiveClaim(id: string): Promise<ArchiveRetractResponse> {
  return request<ArchiveRetractResponse>(`/claims/${id}/archive`, {
    method: "PATCH",
  });
}

export function retractClaim(id: string): Promise<ArchiveRetractResponse> {
  return request<ArchiveRetractResponse>(`/claims/${id}/retract`, {
    method: "PATCH",
  });
}

export function getClaimVersions(id: string): Promise<ClaimVersionResponse[]> {
  return request<ClaimVersionResponse[]>(`/claims/${id}/versions`);
}

export function lockClaim(id: string): Promise<ClaimResponse> {
  return request<ClaimResponse>(`/claims/${id}/lock`, {
    method: "PATCH",
  });
}

export function unlockClaim(id: string): Promise<ClaimResponse> {
  return request<ClaimResponse>(`/claims/${id}/unlock`, {
    method: "PATCH",
  });
}

export function confirmClaim(id: string): Promise<ClaimResponse> {
  return request<ClaimResponse>(`/claims/${id}/confirm`, {
    method: "PATCH",
  });
}

export function updateClaimSensitivity(id: string, sensitivity: Sensitivity): Promise<ClaimResponse> {
  return request<ClaimResponse>(`/claims/${id}/sensitivity`, {
    method: "PATCH",
    body: { sensitivity },
  });
}
