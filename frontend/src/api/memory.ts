import { request } from "@/api/client";

export type RuleConflict = {
  conflict_id: string;
  rule_id: string;
  other_rule_id: string | null;
  conflict_type: "direct" | "interaction" | "budget" | "cap";
  severity: "hard" | "soft";
  detail: string | null;
  resolved: boolean;
};

export type BehavioralRule = {
  rule_id: string;
  domain: string;
  behavior_text: string;
  trigger: Record<string, unknown>;
  effect: Record<string, unknown>;
  artifact_cost: number;
  status: "pending" | "active" | "rejected" | "retired";
  source_type: string;
  previous_rule_id: string | null;
  created_at: string;
  activated_at: string | null;
  expires_at: string | null;
};

export type MemoryStats = {
  claims_by_lane: Record<string, number>;
  open_conflicts: number;
  entities: number;
  relations: number;
  snippets: number;
  behavioral_rules_active: number;
  behavioral_rules_pending: number;
};

export function listBehavioralRules(status?: string): Promise<BehavioralRule[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return request<BehavioralRule[]>(`/memory/rules${query}`);
}

export function listRuleConflicts(ruleId?: string): Promise<RuleConflict[]> {
  const query = ruleId ? `?rule_id=${encodeURIComponent(ruleId)}` : "";
  return request<RuleConflict[]>(`/memory/rules/conflicts${query}`);
}

export function approveBehavioralRule(id: string, overrideSoft = false): Promise<BehavioralRule> {
  return request<BehavioralRule>(`/memory/rules/${id}/approve`, {
    method: "POST",
    body: { override_soft: overrideSoft },
  });
}

export function rejectBehavioralRule(id: string, reason?: string): Promise<BehavioralRule> {
  return request<BehavioralRule>(`/memory/rules/${id}/reject`, {
    method: "POST",
    body: reason ? { reason } : {},
  });
}

export function retireBehavioralRule(id: string, reason?: string): Promise<BehavioralRule> {
  return request<BehavioralRule>(`/memory/rules/${id}/retire`, {
    method: "POST",
    body: reason ? { reason } : {},
  });
}

export function getMemoryStats(): Promise<MemoryStats> {
  return request<MemoryStats>("/memory/stats");
}
