import { request } from "@/api/client";
import type { MailDetail, MailSendResponse, MailSummary, SendMailRequest } from "@/api/types";

type ListMailParams = {
  max_results?: number;
  query?: string;
};

function buildQuery(params: ListMailParams | undefined): string {
  if (!params) {
    return "";
  }

  const searchParams = new URLSearchParams();
  if (typeof params.max_results === "number") {
    searchParams.set("max_results", String(params.max_results));
  }
  if (params.query) {
    searchParams.set("query", params.query);
  }

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export function listMail(params?: ListMailParams): Promise<MailSummary[]> {
  return request<MailSummary[]>(`/mail${buildQuery(params)}`);
}

export function getMail(id: string): Promise<MailDetail> {
  return request<MailDetail>(`/mail/${id}`);
}

export function sendMail(data: SendMailRequest): Promise<MailSendResponse> {
  return request<MailSendResponse>("/mail/send", {
    method: "POST",
    body: data,
  });
}
