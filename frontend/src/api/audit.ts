import { request } from "@/api/client";
import type { AuditListResponse, Sensitivity } from "@/api/types";

export type ListAuditEntriesParams = {
  event_type?: string;
  sensitivity?: Sensitivity;
  result?: string;
  after?: string;
  before?: string;
  limit?: number;
  offset?: number;
};

function buildQuery(params: ListAuditEntriesParams | undefined): string {
  if (!params) {
    return "";
  }

  const searchParams = new URLSearchParams();
  if (params.event_type) {
    searchParams.set("event_type", params.event_type);
  }
  if (params.sensitivity) {
    searchParams.set("sensitivity", params.sensitivity);
  }
  if (params.result) {
    searchParams.set("result", params.result);
  }
  if (params.after) {
    searchParams.set("after", params.after);
  }
  if (params.before) {
    searchParams.set("before", params.before);
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

export function listAuditEntries(params?: ListAuditEntriesParams): Promise<AuditListResponse> {
  return request<AuditListResponse>(`/audit${buildQuery(params)}`);
}
