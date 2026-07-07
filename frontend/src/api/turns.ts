import { ApiError, buildUrl, getErrorMessage, request } from "@/api/client";
import { getToken } from "@/store/auth";
import type { AttachmentExtractResponse, TurnRequest, TurnResult } from "@/api/types";

export type PostTurnOptions = {
  channel?: string;
  claims?: TurnRequest["claims"];
  provider?: TurnRequest["provider"];
  model?: TurnRequest["model"];
  allowS3CloudFallback?: boolean;
  useLiveWeb?: boolean;
  allowS3LiveWeb?: boolean;
  conversationId?: string;
  attachments?: TurnRequest["attachments"];
};

function buildTurnBody(text: string, options: PostTurnOptions): Record<string, unknown> {
  return {
    text,
    channel: options.channel ?? "web",
    claims: options.claims,
    provider: options.provider,
    model: options.model,
    allow_s3_cloud_fallback: options.allowS3CloudFallback,
    use_live_web: options.useLiveWeb,
    allow_s3_live_web: options.allowS3LiveWeb,
    conversation_id: options.conversationId,
    attachments: options.attachments,
  };
}

export async function extractAttachment(file: File): Promise<AttachmentExtractResponse> {
  const form = new FormData();
  form.append("file", file);
  return request<AttachmentExtractResponse>("/turns/attachments/extract", {
    method: "POST",
    body: form,
  });
}

export async function postTurn(text: string, options: PostTurnOptions = {}): Promise<TurnResult> {
  return request<TurnResult>("/turns", {
    method: "POST",
    body: buildTurnBody(text, options),
  });
}

export type TurnStreamErrorData = {
  code: string;
  message: string;
  provider?: string;
  sensitivity?: string;
  fallback_allowed?: boolean;
};

export type TurnStreamEvent =
  | { event: "delta"; data: { text: string } }
  | { event: "result"; data: TurnResult }
  | { event: "error"; data: TurnStreamErrorData };

function parseSseBlock(block: string): TurnStreamEvent | null {
  let eventName = "";
  const dataLines: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) {
      eventName = line.slice("event:".length).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trimStart());
    }
  }
  if (!eventName || dataLines.length === 0) {
    return null;
  }
  try {
    const data = JSON.parse(dataLines.join("\n")) as unknown;
    if (eventName === "delta" || eventName === "result" || eventName === "error") {
      return { event: eventName, data } as TurnStreamEvent;
    }
    return null;
  } catch {
    return null;
  }
}

export async function* streamTurn(
  text: string,
  options: PostTurnOptions = {},
  signal?: AbortSignal,
): AsyncGenerator<TurnStreamEvent> {
  const headers = new Headers({ "Content-Type": "application/json" });
  const token = getToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(buildUrl("/turns/stream"), {
    method: "POST",
    headers,
    body: JSON.stringify(buildTurnBody(text, options)),
    signal,
  });

  if (!response.ok || !response.body) {
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      // Non-JSON error body; keep default message.
    }
    throw new ApiError(
      getErrorMessage(payload, response.status >= 500 ? "Server error" : "Request failed"),
      response.status,
      payload,
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      let separatorIndex = buffer.indexOf("\n\n");
      while (separatorIndex >= 0) {
        const block = buffer.slice(0, separatorIndex);
        buffer = buffer.slice(separatorIndex + 2);
        const parsed = parseSseBlock(block);
        if (parsed) {
          yield parsed;
        }
        separatorIndex = buffer.indexOf("\n\n");
      }
    }
  } finally {
    reader.releaseLock();
  }
}
