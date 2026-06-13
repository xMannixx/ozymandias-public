import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/api/client";
import {
  approveBehavioralRule,
  listBehavioralRules,
  listRuleConflicts,
  rejectBehavioralRule,
  retireBehavioralRule,
  type BehavioralRule,
  type RuleConflict,
} from "@/api/memory";

export type BehavioralRulesToast = {
  message: string;
  type: "success" | "error";
};

type UseBehavioralRulesResult = {
  rules: BehavioralRule[];
  conflicts: RuleConflict[];
  loading: boolean;
  error: string | null;
  toast: BehavioralRulesToast | null;
  approve: (id: string, overrideSoft?: boolean) => Promise<void>;
  reject: (id: string, reason?: string) => Promise<void>;
  retire: (id: string, reason?: string) => Promise<void>;
  clearToast: () => void;
  refetch: () => Promise<void>;
};

function normalizeError(error: unknown): string {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }
  return "Unbekannter Fehler";
}

export function useBehavioralRules(): UseBehavioralRulesResult {
  const [rules, setRules] = useState<BehavioralRule[]>([]);
  const [conflicts, setConflicts] = useState<RuleConflict[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<BehavioralRulesToast | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ruleData, conflictData] = await Promise.all([
        listBehavioralRules(),
        listRuleConflicts(),
      ]);
      setRules(Array.isArray(ruleData) ? ruleData : []);
      setConflicts(Array.isArray(conflictData) ? conflictData : []);
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const approve = useCallback(
    async (id: string, overrideSoft = false) => {
      try {
        await approveBehavioralRule(id, overrideSoft);
        setToast({ type: "success", message: "Regel aktiviert." });
        await refetch();
      } catch (err) {
        setToast({ type: "error", message: normalizeError(err) });
      }
    },
    [refetch],
  );

  const reject = useCallback(
    async (id: string, reason?: string) => {
      try {
        await rejectBehavioralRule(id, reason);
        setToast({ type: "success", message: "Regel abgelehnt." });
        await refetch();
      } catch (err) {
        setToast({ type: "error", message: normalizeError(err) });
      }
    },
    [refetch],
  );

  const retire = useCallback(
    async (id: string, reason?: string) => {
      try {
        await retireBehavioralRule(id, reason);
        setToast({ type: "success", message: "Regel stillgelegt." });
        await refetch();
      } catch (err) {
        setToast({ type: "error", message: normalizeError(err) });
      }
    },
    [refetch],
  );

  const clearToast = useCallback(() => setToast(null), []);

  return {
    rules,
    conflicts,
    loading,
    error,
    toast,
    approve,
    reject,
    retire,
    clearToast,
    refetch,
  };
}
