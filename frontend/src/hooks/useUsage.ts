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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A misrouted request can answer 200 with HTML, which must not crash the page. */
function isUsageReport(value: unknown): value is UsageReport {
  if (!isRecord(value)) {
    return false;
  }
  return (
    isRecord(value.totals) &&
    typeof value.bucket_unit === "string" &&
    Array.isArray(value.top_models) &&
    Array.isArray(value.top_providers) &&
    Array.isArray(value.errors_by_kind) &&
    Array.isArray(value.series)
  );
}

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
      const response = await getUsageReport(target);
      if (!isUsageReport(response)) {
        throw new Error("Invalid usage data from server");
      }
      setReport(response);
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
