import { request } from "@/api/client";
import type { BriefingResponse } from "@/api/types";

/** Null until the heartbeat has written the first briefing. */
export function getLatestBriefing(): Promise<BriefingResponse | null> {
  return request<BriefingResponse | null>("/briefings/latest");
}
