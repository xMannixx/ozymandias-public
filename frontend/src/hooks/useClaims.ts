import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "@/api/client";
import {
  archiveClaim as archiveClaimApi,
  confirmClaim as confirmClaimApi,
  getClaimVersions,
  listClaims,
  lockClaim as lockClaimApi,
  retractClaim as retractClaimApi,
  unlockClaim as unlockClaimApi,
  updateClaimSensitivity as updateClaimSensitivityApi,
} from "@/api/claims";
import type { ClaimResponse, ClaimVersionResponse, Sensitivity } from "@/api/types";

export type ClaimsToast = {
  message: string;
  type: "success" | "error" | "info";
};

export type ClaimsFilters = {
  sensitivities: Sensitivity[];
  memoryType: string;
  lifecycle: string;
  verificationState: string;
  trustLevel: string;
};

const defaultFilters: ClaimsFilters = {
  sensitivities: [],
  memoryType: "",
  lifecycle: "",
  verificationState: "",
  trustLevel: "",
};

type UseClaimsResult = {
  claims: ClaimResponse[];
  filteredClaims: ClaimResponse[];
  loading: boolean;
  error: string | null;
  filters: ClaimsFilters;
  searchQuery: string;
  selectedClaim: ClaimResponse | null;
  versions: ClaimVersionResponse[];
  versionsLoading: boolean;
  toast: ClaimsToast | null;
  setFilters: (updater: ClaimsFilters | ((current: ClaimsFilters) => ClaimsFilters)) => void;
  resetFilters: () => void;
  setSearchQuery: (value: string) => void;
  selectClaim: (claim: ClaimResponse | null) => Promise<void>;
  confirmClaim: (id: string) => Promise<void>;
  retractClaim: (id: string) => Promise<void>;
  archiveClaim: (id: string) => Promise<void>;
  lockClaim: (id: string) => Promise<void>;
  unlockClaim: (id: string) => Promise<void>;
  updateSensitivity: (id: string, sensitivity: Sensitivity) => Promise<void>;
  clearToast: () => void;
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

function isConflict(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === 409;
}

function applyClientFilters(claims: ClaimResponse[], filters: ClaimsFilters, searchQuery: string): ClaimResponse[] {
  const query = searchQuery.trim().toLowerCase();
  return claims.filter((claim) => {
    if (filters.sensitivities.length > 0 && !filters.sensitivities.includes(claim.sensitivity)) {
      return false;
    }
    if (filters.memoryType && claim.memory_type.toLowerCase() !== filters.memoryType.toLowerCase()) {
      return false;
    }
    if (filters.lifecycle && claim.lifecycle.toLowerCase() !== filters.lifecycle.toLowerCase()) {
      return false;
    }
    if (
      filters.verificationState &&
      claim.verification_state.toLowerCase() !== filters.verificationState.toLowerCase()
    ) {
      return false;
    }
    if (filters.trustLevel && claim.trust_level.toLowerCase() !== filters.trustLevel.toLowerCase()) {
      return false;
    }
    if (query) {
      const haystack = `${claim.subject} ${claim.value}`.toLowerCase();
      if (!haystack.includes(query)) {
        return false;
      }
    }
    return true;
  });
}

export function useClaims(): UseClaimsResult {
  const [claims, setClaims] = useState<ClaimResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<ClaimsFilters>(defaultFilters);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClaim, setSelectedClaim] = useState<ClaimResponse | null>(null);
  const [versions, setVersions] = useState<ClaimVersionResponse[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [toast, setToast] = useState<ClaimsToast | null>(null);
  const latestClaimRequestRef = useRef<string | null>(null);
  const selectedClaimIdRef = useRef<string | null>(null);
  selectedClaimIdRef.current = selectedClaim?.claim_id ?? null;

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nextClaims = await listClaims();
      setClaims(nextClaims);
      const id = selectedClaimIdRef.current;
      if (id) {
        const updated = nextClaims.find((item) => item.claim_id === id) ?? null;
        setSelectedClaim(updated);
      }
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const filteredClaims = useMemo(
    () => applyClientFilters(claims, filters, searchQuery),
    [claims, filters, searchQuery],
  );

  const selectClaim = useCallback(async (claim: ClaimResponse | null) => {
    const requestId = `${claim?.claim_id ?? "none"}:${Date.now().toString()}:${Math.random().toString(16).slice(2)}`;
    latestClaimRequestRef.current = requestId;
    setSelectedClaim(claim);
    setVersions([]);
    setVersionsLoading(Boolean(claim));
    if (!claim) {
      return;
    }
    try {
      const nextVersions = await getClaimVersions(claim.claim_id);
      if (latestClaimRequestRef.current !== requestId) {
        return;
      }
      setVersions(nextVersions);
    } catch (err) {
      if (latestClaimRequestRef.current !== requestId) {
        return;
      }
      setToast({ type: "error", message: normalizeError(err) });
    } finally {
      if (latestClaimRequestRef.current === requestId) {
        setVersionsLoading(false);
      }
    }
  }, []);

  const updateClaimInState = useCallback((updated: ClaimResponse) => {
    setClaims((prev) => prev.map((claim) => (claim.claim_id === updated.claim_id ? updated : claim)));
    setSelectedClaim((prev) => (prev?.claim_id === updated.claim_id ? updated : prev));
  }, []);

  const confirmClaim = useCallback(
    async (id: string) => {
      try {
        const updated = await confirmClaimApi(id);
        updateClaimInState(updated);
        setToast({ type: "success", message: "Memory confirmed." });
      } catch (err) {
        const message = normalizeError(err);
        setToast({ type: "error", message: isConflict(err) ? `Conflict: ${message}` : message });
      }
    },
    [updateClaimInState],
  );

  const retractClaim = useCallback(async (id: string) => {
    try {
      await retractClaimApi(id);
      setClaims((prev) =>
        prev.map((claim) =>
          claim.claim_id === id
            ? { ...claim, verification_state: "retracted", superseded_at: new Date().toISOString() }
            : claim,
        ),
      );
      setSelectedClaim((prev) =>
        prev && prev.claim_id === id
          ? { ...prev, verification_state: "retracted", superseded_at: new Date().toISOString() }
          : prev,
      );
      setToast({ type: "success", message: "Memory retracted. It will no longer be used." });
    } catch (err) {
      const message = normalizeError(err);
      setToast({ type: "error", message: isConflict(err) ? `Conflict: ${message}` : message });
    }
  }, []);

  const archiveClaim = useCallback(async (id: string) => {
    try {
      await archiveClaimApi(id);
      setClaims((prev) =>
        prev.map((claim) => (claim.claim_id === id ? { ...claim, lifecycle: "archived" } : claim)),
      );
      setSelectedClaim((prev) => (prev && prev.claim_id === id ? { ...prev, lifecycle: "archived" } : prev));
      setToast({ type: "success", message: "Memory archived." });
    } catch (err) {
      const message = normalizeError(err);
      setToast({ type: "error", message: isConflict(err) ? `Conflict: ${message}` : message });
    }
  }, []);

  const lockClaim = useCallback(
    async (id: string) => {
      try {
        const updated = await lockClaimApi(id);
        updateClaimInState(updated);
        setToast({ type: "success", message: "Memory locked." });
      } catch (err) {
        const message = normalizeError(err);
        setToast({ type: "error", message: isConflict(err) ? `Conflict: ${message}` : message });
      }
    },
    [updateClaimInState],
  );

  const unlockClaim = useCallback(
    async (id: string) => {
      try {
        const updated = await unlockClaimApi(id);
        updateClaimInState(updated);
        setToast({ type: "success", message: "Memory unlocked." });
      } catch (err) {
        const message = normalizeError(err);
        setToast({ type: "error", message: isConflict(err) ? `Conflict: ${message}` : message });
      }
    },
    [updateClaimInState],
  );

  const updateSensitivity = useCallback(
    async (id: string, sensitivity: Sensitivity) => {
      try {
        const updated = await updateClaimSensitivityApi(id, sensitivity);
        updateClaimInState(updated);
        setToast({ type: "success", message: "Sensitivity updated." });
      } catch (err) {
        const message = normalizeError(err);
        setToast({ type: "error", message: isConflict(err) ? `Conflict: ${message}` : message });
      }
    },
    [updateClaimInState],
  );

  const setFilters = useCallback((updater: ClaimsFilters | ((current: ClaimsFilters) => ClaimsFilters)) => {
    setFiltersState((current) => (typeof updater === "function" ? updater(current) : updater));
  }, []);

  const resetFilters = useCallback(() => {
    setFiltersState(defaultFilters);
  }, []);

  const clearToast = useCallback(() => {
    setToast(null);
  }, []);

  return {
    claims,
    filteredClaims,
    loading,
    error,
    filters,
    searchQuery,
    selectedClaim,
    versions,
    versionsLoading,
    toast,
    setFilters,
    resetFilters,
    setSearchQuery,
    selectClaim,
    confirmClaim,
    retractClaim,
    archiveClaim,
    lockClaim,
    unlockClaim,
    updateSensitivity,
    clearToast,
    refetch,
  };
}
