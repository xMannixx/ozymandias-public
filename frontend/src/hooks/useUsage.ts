import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/api/client";
import { getUsageReport } from "@/api/usage";
import type { UsageRange, UsageReport } from "@/api/types";

type UseUsageResult = {
  report: UsageReport | null;
  range: UsageRange;
  setRange: (value: UsageRange) => void;
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
  return "Unknown error";
}

export function useUsage(initialRange: UsageRange = "24h"): UseUsageResult {
  const [range, setRange] = useState<UsageRange>(initialRange);
  const [report, setReport] = useState<UsageReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (target: UsageRange) => {
    setLoading(true);
    setError(null);
    try {
      setReport(await getUsageReport(target));
    } catch (err) {
      setError(normalizeError(err));
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(range);
  }, [load, range]);

  const refetch = useCallback(() => load(range), [load, range]);

  return { report, range, setRange, loading, error, refetch };
}
