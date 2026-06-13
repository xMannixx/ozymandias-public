import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/api/client";
import { getDashboardStats } from "@/api/stats";
import type { DashboardStats } from "@/api/types";

type UseDashboardResult = {
  stats: DashboardStats | null;
  loading: boolean;
  error: string | null;
  autoRefresh: boolean;
  setAutoRefresh: (value: boolean) => void;
  refetch: () => Promise<void>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDashboardStats(value: unknown): value is DashboardStats {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.claims_total === "number" &&
    isRecord(value.claims_by_verification) &&
    isRecord(value.claims_by_sensitivity) &&
    typeof value.proposals_pending === "number" &&
    typeof value.proposals_total === "number" &&
    isRecord(value.circuit_breaker) &&
    Array.isArray(value.recent_actions) &&
    isRecord(value.provider_usage) &&
    typeof value.projects_active === "number" &&
    typeof value.projects_tasks_open === "number" &&
    typeof value.projects_risks_critical === "number" &&
    (typeof value.projects_next_milestone === "string" || value.projects_next_milestone === null) &&
    typeof value.contacts_total === "number"
  );
}

function normalizeError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Unbekannter Fehler";
}

export function useDashboard(): UseDashboardResult {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getDashboardStats();
      if (!isDashboardStats(response)) {
        throw new Error("Ungueltige Dashboard-Daten vom Server");
      }
      setStats(response);
    } catch (err) {
      setError(normalizeError(err));
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  useEffect(() => {
    if (!autoRefresh) {
      return;
    }
    const timer = window.setInterval(() => {
      void refetch();
    }, 30000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, refetch]);

  return { stats, loading, error, autoRefresh, setAutoRefresh, refetch };
}
