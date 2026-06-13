import { useCallback, useEffect, useState } from "react";
import { getGoogleStatus } from "@/api/auth";
import { ApiError } from "@/api/client";
import type { GoogleStatusResponse } from "@/api/types";

type UseGoogleStatusResult = {
  connected: boolean;
  email: string | null;
  scopes: string[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<GoogleStatusResponse | null>;
};

function normalizeError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Google-Status konnte nicht geladen werden";
}

export function useGoogleStatus(): UseGoogleStatusResult {
  const [status, setStatus] = useState<GoogleStatusResponse>({
    connected: false,
    email: null,
    scopes: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getGoogleStatus();
      setStatus(response);
      return response;
    } catch (err) {
      setError(normalizeError(err));
      setStatus({
        connected: false,
        email: null,
        scopes: [],
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return {
    connected: status.connected,
    email: status.email,
    scopes: status.scopes,
    loading,
    error,
    refetch,
  };
}
