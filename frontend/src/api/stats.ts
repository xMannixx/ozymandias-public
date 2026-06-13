import { request } from "@/api/client";
import type { DashboardStats } from "@/api/types";

export function getDashboardStats(): Promise<DashboardStats> {
  return request<DashboardStats>("/stats");
}
