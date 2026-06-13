import { useCallback, useEffect, useMemo, useState } from "react";
import { listAuditEntries } from "@/api/audit";
import { ApiError } from "@/api/client";
import type { AuditEntryResponse, Sensitivity } from "@/api/types";

export type AuditFilters = {
  event_type: string;
  sensitivity: Sensitivity | "";
  result: string;
  after: string;
  before: string;
};

export const defaultAuditFilters: AuditFilters = {
  event_type: "",
  sensitivity: "",
  result: "",
  after: "",
  before: "",
};

type UseAuditResult = {
  entries: AuditEntryResponse[];
  total: number;
  loading: boolean;
  error: string | null;
  filters: AuditFilters;
  page: number;
  limit: number;
  showS4: boolean;
  setFilters: (updater: AuditFilters | ((current: AuditFilters) => AuditFilters)) => void;
  resetFilters: () => void;
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;
  setShowS4: (value: boolean) => void;
  refetch: () => Promise<void>;
};

function normalizeError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Unbekannter Fehler";
}

export function useAudit(): UseAuditResult {
  const [entries, setEntries] = useState<AuditEntryResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<AuditFilters>(defaultAuditFilters);
  const [page, setPageState] = useState(1);
  const [limit, setLimitState] = useState(50);
  const [showS4, setShowS4] = useState(false);

  const offset = useMemo(() => Math.max(0, (page - 1) * limit), [page, limit]);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await listAuditEntries({
        event_type: filters.event_type || undefined,
        sensitivity: showS4 ? "S4" : filters.sensitivity || undefined,
        result: filters.result || undefined,
        after: filters.after || undefined,
        before: filters.before || undefined,
        limit,
        offset,
      });
      setEntries(response.entries);
      setTotal(response.total);
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setLoading(false);
    }
  }, [filters, limit, offset, showS4]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const setFilters = useCallback((updater: AuditFilters | ((current: AuditFilters) => AuditFilters)) => {
    setFiltersState((current) => (typeof updater === "function" ? updater(current) : updater));
    setPageState(1);
  }, []);

  const resetFilters = useCallback(() => {
    setFiltersState(defaultAuditFilters);
    setPageState(1);
    setShowS4(false);
  }, []);

  const setPage = useCallback((nextPage: number) => {
    setPageState(Math.max(1, nextPage));
  }, []);

  const setLimit = useCallback((nextLimit: number) => {
    setLimitState(nextLimit);
    setPageState(1);
  }, []);

  return {
    entries,
    total,
    loading,
    error,
    filters,
    page,
    limit,
    showS4,
    setFilters,
    resetFilters,
    setPage,
    setLimit,
    setShowS4,
    refetch,
  };
}
