import { request } from "@/api/client";
import type { TurnRequest, TurnResult } from "@/api/types";

export type PostTurnOptions = {
  channel?: string;
  claims?: TurnRequest["claims"];
  provider?: TurnRequest["provider"];
  model?: TurnRequest["model"];
  allowS3CloudFallback?: boolean;
  useLiveWeb?: boolean;
  allowS3LiveWeb?: boolean;
  conversationId?: string;
};

export async function postTurn(text: string, options: PostTurnOptions = {}): Promise<TurnResult> {
  return request<TurnResult>("/turns", {
    method: "POST",
    body: {
      text,
      channel: options.channel ?? "web",
      claims: options.claims,
      provider: options.provider,
      model: options.model,
      allow_s3_cloud_fallback: options.allowS3CloudFallback,
      use_live_web: options.useLiveWeb,
      allow_s3_live_web: options.allowS3LiveWeb,
      conversation_id: options.conversationId,
    },
  });
}
