import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/api/client";
import { getHealth } from "@/api/health";
import type { HealthResponse } from "@/api/types";

type UseHealthResult = {
  health: HealthResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

function normalizeError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Failed to load health status";
}

export function useHealth(pollIntervalMs: number | null = null): UseHealthResult {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getHealth();
      setHealth(response);
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  useEffect(() => {
    if (pollIntervalMs === null) {
      return;
    }
    const timer = window.setInterval(() => {
      void refetch();
    }, pollIntervalMs);
    return () => window.clearInterval(timer);
  }, [pollIntervalMs, refetch]);

  return { health, loading, error, refetch };
}
