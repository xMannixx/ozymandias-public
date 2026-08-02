import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/api/client";
import { getLatestBriefing } from "@/api/briefings";
import type { BriefingResponse } from "@/api/types";

type UseBriefingResult = {
  briefing: BriefingResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A misrouted request can answer 200 with HTML, which must not crash the page. */
function isBriefing(value: unknown): value is BriefingResponse {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.briefing_id === "string" &&
    typeof value.briefing_date === "string" &&
    typeof value.content === "string" &&
    Array.isArray(value.sections)
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

export function useBriefing(): UseBriefingResult {
  const [briefing, setBriefing] = useState<BriefingResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getLatestBriefing();
      // Before the first heartbeat there is nothing, which is not an error.
      if (response === null) {
        setBriefing(null);
        return;
      }
      if (!isBriefing(response)) {
        throw new Error("Invalid briefing data from server");
      }
      setBriefing(response);
    } catch (err) {
      setError(normalizeError(err));
      setBriefing(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { briefing, loading, error, refetch };
}
