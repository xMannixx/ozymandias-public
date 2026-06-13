import { request } from "@/api/client";
import type { HealthResponse } from "@/api/types";

export function getHealth(): Promise<HealthResponse> {
  return request<HealthResponse>("/health");
}
