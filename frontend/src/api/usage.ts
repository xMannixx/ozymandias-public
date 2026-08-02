import { request } from "@/api/client";
import type { UsageRange, UsageReport } from "@/api/types";

export function getUsageReport(range: UsageRange): Promise<UsageReport> {
  return request<UsageReport>(`/usage?range=${encodeURIComponent(range)}`);
}
