import { request } from "@/api/client";
import type { TurnRequest, TurnResult } from "@/api/types";

export async function postTurn(
  text: string,
  channel = "web",
  claims: TurnRequest["claims"] = undefined,
  provider: TurnRequest["provider"] = undefined,
  model: TurnRequest["model"] = undefined,
  allowS3CloudFallback: TurnRequest["allow_s3_cloud_fallback"] = undefined,
  useLiveWeb: TurnRequest["use_live_web"] = undefined,
  allowS3LiveWeb: TurnRequest["allow_s3_live_web"] = undefined,
): Promise<TurnResult> {
  return request<TurnResult>("/turns", {
    method: "POST",
    body: {
      text,
      channel,
      claims,
      provider,
      model,
      allow_s3_cloud_fallback: allowS3CloudFallback,
      use_live_web: useLiveWeb,
      allow_s3_live_web: allowS3LiveWeb,
    },
  });
}
