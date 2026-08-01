import type {
  AuditEntryResponse,
  ClaimResponse,
  ClaimVersionResponse,
  DashboardStats,
  HealthResponse,
  ProposedClaimData,
  ProposalResponse,
  UserSettingsResponse,
} from "@/api/types";

function withOverrides<T>(base: T, overrides: Partial<T>): T {
  return { ...base, ...overrides };
}

const baseClaim: ClaimResponse = {
  claim_id: "11111111-1111-1111-1111-111111111111",
  user_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  subject: "user",
  attribute: "preference",
  value: "dark mode",
  content: "User prefers dark mode.",
  memory_type: "Preference",
  verification_state: "tentative",
  confidence: 0.72,
  source_ref: "turn-1",
  source_type: "model_inferred",
  sensitivity: "S1",
  trust_level: "T2",
  handling_policy: "cloud_ok_encrypted",
  user_locked: false,
  decay_eligible: true,
  lifecycle: "temporary",
  valid_from: null,
  valid_to: null,
  ingested_at: "2026-04-04T10:00:00Z",
  superseded_at: null,
  review_due: false,
  last_reviewed: null,
  last_accessed: "2026-04-04T11:00:00Z",
  created_at: "2026-04-04T10:00:00Z",
  updated_at: "2026-04-04T11:00:00Z",
};

const baseProposedClaim: ProposedClaimData = {
  subject: "user",
  attribute: "location",
  value: "Vienna",
  content: "User currently lives in Vienna.",
  memory_type: "Profile",
  verification_state: "tentative",
  confidence: 0.8,
  source_ref: "turn-2",
  source_type: "model_inferred",
  sensitivity: "S1",
  trust_level: "T2",
  handling_policy: "cloud_ok_encrypted",
  user_locked: false,
  decay_eligible: true,
  lifecycle: "temporary",
  valid_from: null,
  valid_to: null,
};

const baseProposal: ProposalResponse = {
  proposal_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  user_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  proposed_claim: baseProposedClaim,
  source_ref: "turn-2",
  source_type: "model_inferred",
  status: "pending",
  conflict_group_id: null,
  rejection_reason: null,
  created_at: "2026-04-04T11:10:00Z",
  decided_at: null,
  decided_by: null,
};

export const mockClaimS0 = withOverrides(baseClaim, {
  claim_id: "c-s0",
  sensitivity: "S0",
  subject: "project",
  attribute: "name",
  value: "Ozymandias",
});

export const mockClaimS4 = withOverrides(baseClaim, {
  claim_id: "c-s4",
  sensitivity: "S4",
  handling_policy: "s4_isolated",
  subject: "relationship",
  attribute: "status",
  value: "private",
  content: "Sensitive relationship detail.",
});

export const mockClaimTentative = withOverrides(baseClaim, {
  claim_id: "c-tentative",
  verification_state: "tentative",
});

export const mockClaimRetracted = withOverrides(baseClaim, {
  claim_id: "c-retracted",
  verification_state: "retracted",
  superseded_at: "2026-04-05T11:00:00Z",
});

export const mockClaimLocked = withOverrides(baseClaim, {
  claim_id: "c-locked",
  user_locked: true,
  decay_eligible: false,
});

export const mockClaimLowConfidence = withOverrides(baseClaim, {
  claim_id: "c-low-confidence",
  confidence: 0.31,
});

export const mockClaimReviewDue = withOverrides(baseClaim, {
  claim_id: "c-review-due",
  review_due: true,
});

export const mockClaimArchived = withOverrides(baseClaim, {
  claim_id: "c-archived",
  lifecycle: "archived",
  verification_state: "confirmed",
});

export const mockProposalPending = withOverrides(baseProposal, {
  proposal_id: "p-pending",
  status: "pending",
});

export const mockProposalConfirmed = withOverrides(baseProposal, {
  proposal_id: "p-confirmed",
  status: "confirmed",
  decided_at: "2026-04-04T11:20:00Z",
  decided_by: "user",
});

export const mockProposalAutoConfirmed = withOverrides(baseProposal, {
  proposal_id: "p-auto-confirmed",
  status: "auto_confirmed",
  decided_at: "2026-04-04T11:25:00Z",
  decided_by: "auto_confirm",
});

export const mockProposalRejected = withOverrides(baseProposal, {
  proposal_id: "p-rejected",
  status: "rejected",
  rejection_reason: "Insufficient confidence.",
  decided_at: "2026-04-04T11:30:00Z",
  decided_by: "user",
});

export const mockProposalWithConflict = withOverrides(baseProposal, {
  proposal_id: "p-conflict",
  conflict_group_id: "cg-123",
});

export const mockClaimVersions: ClaimVersionResponse[] = [
  {
    version_id: "v-3",
    claim_id: "c-archived",
    version_number: 3,
    version_hash: "hash-3-abcdef123456",
    previous_hash: "hash-2-abcdef123456",
    content_snapshot: { lifecycle: "archived", verification_state: "confirmed" },
    change_reason: "Archived due to stale relevance.",
    changed_by: "user",
    created_at: "2026-04-06T10:00:00Z",
  },
  {
    version_id: "v-2",
    claim_id: "c-archived",
    version_number: 2,
    version_hash: "hash-2-abcdef123456",
    previous_hash: "hash-1-abcdef123456",
    content_snapshot: { verification_state: "confirmed", confidence: 0.92 },
    change_reason: "User confirmed claim.",
    changed_by: "user",
    created_at: "2026-04-05T10:00:00Z",
  },
  {
    version_id: "v-1",
    claim_id: "c-archived",
    version_number: 1,
    version_hash: "hash-1-abcdef123456",
    previous_hash: null,
    content_snapshot: { verification_state: "tentative", confidence: 0.72 },
    change_reason: "Initial extraction.",
    changed_by: "system",
    created_at: "2026-04-04T10:00:00Z",
  },
];

const baseAuditEntry: AuditEntryResponse = {
  audit_id: "audit-1",
  event_type: "turn_processed",
  user_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  channel: "web",
  payload: { provider: "deepseek", latency_ms: 120 },
  source_ref: "turn-99",
  result: "success",
  sensitivity: "S0",
  created_at: "2026-04-06T12:00:00Z",
};

export const mockAuditTurnProcessed = withOverrides(baseAuditEntry, {
  audit_id: "audit-turn",
  event_type: "turn_processed",
  result: "success",
  sensitivity: "S0",
});

export const mockAuditMemoryConfirmed = withOverrides(baseAuditEntry, {
  audit_id: "audit-memory-confirmed",
  event_type: "memory_confirmed",
});

export const mockAuditSensitivityViolation = withOverrides(baseAuditEntry, {
  audit_id: "audit-sensitivity-violation",
  event_type: "sensitivity_violation",
  result: "blocked",
  sensitivity: "S4",
});

export const mockAuditS4 = withOverrides(baseAuditEntry, {
  audit_id: "audit-s4",
  event_type: "memory_confirmed",
  sensitivity: "S4",
  payload: { note: "sensitive" },
});

export const mockAuditList: AuditEntryResponse[] = [
  mockAuditTurnProcessed,
  mockAuditMemoryConfirmed,
  mockAuditSensitivityViolation,
  mockAuditS4,
  withOverrides(baseAuditEntry, { audit_id: "audit-5", event_type: "action_executed", result: "success" }),
  withOverrides(baseAuditEntry, { audit_id: "audit-6", event_type: "action_blocked", result: "blocked" }),
  withOverrides(baseAuditEntry, { audit_id: "audit-7", event_type: "manual_override", result: "success" }),
  withOverrides(baseAuditEntry, { audit_id: "audit-8", event_type: "security_event", result: "failed" }),
  withOverrides(baseAuditEntry, { audit_id: "audit-9", event_type: "memory_retracted", result: "success" }),
  withOverrides(baseAuditEntry, { audit_id: "audit-10", event_type: "taint_escalation", result: "success" }),
];

export const mockDashboardStats: DashboardStats = {
  claims_total: 12,
  claims_by_verification: {
    tentative: 4,
    confirmed: 6,
    superseded: 1,
    retracted: 1,
  },
  claims_by_sensitivity: {
    S0: 3,
    S1: 4,
    S2: 2,
    S3: 2,
    S4: 1,
  },
  proposals_pending: 2,
  proposals_total: 5,
  circuit_breaker: {
    current_count: 3,
    is_tripped: false,
    max_actions: 10,
    window_seconds: 60,
    cooldown_seconds: 120,
  },
  recent_actions: mockAuditList,
  provider_usage: {
    deepseek: 5,
    gemini: 2,
    openai: 1,
    ollama: 3,
  },
  projects_active: 3,
  projects_tasks_open: 11,
  projects_knowledge_files: 4,
  projects_next_due_task: "File the return (2026-05-31)",
  contacts_total: 0,
};

export const mockSettings: UserSettingsResponse = {
  mode: "guardian",
  kill_switch: false,
  decay_interval_hours: 24,
  decay_confidence_threshold: 0.6,
  cb_max_actions_override: null,
  cb_window_seconds_override: null,
  cb_cooldown_seconds_override: null,
  preferred_provider: null,
  preferred_model: null,
  preferred_local_provider: null,
  preferred_local_model: null,
  live_web_enabled: false,
  live_web_mode: "provider_native_first",
  live_web_s3_confirmed_default: false,
  voice_enabled: false,
  voice_mode: "push_to_talk",
  tts_voice: "ash",
  tts_model: "tts-1",
  tts_autoplay: true,
  updated_at: "2026-04-06T12:00:00Z",
};

export const mockSettingsAutopilot: UserSettingsResponse = withOverrides(mockSettings, {
  mode: "autopilot",
});

export const mockSettingsKillSwitch: UserSettingsResponse = withOverrides(mockSettings, {
  kill_switch: true,
  mode: "guardian",
});

export const mockHealthResponse: HealthResponse = {
  status: "ok",
  database: "ok",
  redis: "ok",
  rust_bindings: "ok",
  llm_providers: ["deepseek", "ollama"],
  llm_provider_health: [
    {
      name: "deepseek",
      is_local: false,
      configured: true,
      status: "configured",
      model: "deepseek-chat",
      detail: null,
    },
    {
      name: "ollama",
      is_local: true,
      configured: true,
      status: "ok",
      model: "llama3.1:8b",
      detail: null,
    },
  ],
  live_web: {
    connector_status: "configured",
    connector_detail: null,
    native_provider_candidates: ["openai", "deepseek"],
  },
};
