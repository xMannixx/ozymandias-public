import type { Sensitivity } from "@/api/types";

export const SENSITIVITY_LABELS: Record<Sensitivity, string> = {
  S0: "Public",
  S1: "General",
  S2: "Personal",
  S3: "Confidential",
  S4: "Intimate",
};

export const SENSITIVITY_DESCRIPTIONS: Record<Sensitivity, string> = {
  S0: "No restrictions - safe to share anywhere.",
  S1: "General information about you. Can be sent to any provider.",
  S2: "Personal details. Only sent to encrypted providers.",
  S3: "Confidential (finance, credentials, security-relevant). Stays on your device unless you explicitly allow a cloud fallback.",
  S4: "Intimate. Always stays on your local device and is never sent to the cloud.",
};

export const TRUST_LABELS: Record<string, string> = {
  T0: "Untrusted",
  T1: "Low trust",
  T2: "Trusted",
  T3: "Verified by you",
};

export const TRUST_DESCRIPTIONS: Record<string, string> = {
  T0: "Unverified source, e.g. inferred without confirmation.",
  T1: "Weakly trusted source.",
  T2: "Trusted source, typically inferred from what you said.",
  T3: "You explicitly confirmed this yourself.",
};

export const LIFECYCLE_LABELS: Record<string, string> = {
  session: "This session only",
  temporary: "Temporary",
  permanent: "Permanent",
  expiry: "Expires",
  archived: "Archived",
};

export const LIFECYCLE_DESCRIPTIONS: Record<string, string> = {
  session: "Only kept for the current conversation.",
  temporary: "Kept until it decays or is replaced.",
  permanent: "Kept indefinitely.",
  expiry: "Will expire on a set date.",
  archived: "No longer active, kept for history.",
};

export const VERIFICATION_LABELS: Record<string, string> = {
  tentative: "Needs review",
  confirmed: "Confirmed",
  retracted: "Retracted",
  superseded: "Superseded",
};

export const VERIFICATION_DESCRIPTIONS: Record<string, string> = {
  tentative: "Not yet confirmed - Ozymandias inferred this on its own.",
  confirmed: "You confirmed this is correct.",
  retracted: "Marked as wrong. No longer used.",
  superseded: "Replaced by a newer memory.",
};

export const HANDLING_POLICY_LABELS: Record<string, string> = {
  cloud_ok_encrypted: "Cloud allowed (encrypted)",
  local_only: "Local only",
  local_preferred: "Prefers local",
  s4_isolated: "Local only, isolated",
};

export const HANDLING_POLICY_DESCRIPTIONS: Record<string, string> = {
  cloud_ok_encrypted: "May be sent to an encrypted cloud provider.",
  local_only: "Never leaves your local device.",
  local_preferred: "Prefers a local provider when one is available.",
  s4_isolated: "Handled in strict isolation. Never leaves your local device.",
};

export const SOURCE_TYPE_LABELS: Record<string, string> = {
  user_explicit: "You said this directly",
  model_inferred: "Ozymandias inferred this",
  user_confirmed: "You confirmed this",
  connector_data: "Imported from a connected service",
};

export const PROPOSAL_STATUS_LABELS: Record<string, string> = {
  pending: "Waiting for your review",
  confirmed: "Approved",
  auto_confirmed: "Auto-approved",
  rejected: "Rejected",
};

export const AUDIT_EVENT_LABELS: Record<string, string> = {
  turn_processed: "Chat message processed",
  memory_confirmed: "Memory confirmed",
  memory_rejected: "Memory rejected",
  memory_superseded: "Memory superseded",
  memory_retracted: "Memory retracted",
  action_executed: "Action executed",
  action_blocked: "Action blocked",
  action_rolled_back: "Action rolled back",
  sensitivity_violation: "Sensitivity violation",
  circuit_breaker_tripped: "Circuit breaker tripped",
  payload_sensitivity_warning: "Sensitivity warning",
  taint_escalation: "Taint escalation",
  security_event: "Security event",
  manual_override: "Manual override",
};

export const AUDIT_RESULT_LABELS: Record<string, string> = {
  success: "Success",
  failed: "Failed",
  blocked: "Blocked",
  rolled_back: "Rolled back",
};

const LIFECYCLE_STATUS_PHRASES: Record<string, string> = {
  session: "kept for this session only",
  temporary: "kept temporarily",
  permanent: "kept permanently",
  expiry: "kept until it expires",
  archived: "archived",
};

const HANDLING_POLICY_PHRASES: Record<string, string> = {
  cloud_ok_encrypted: "cloud allowed if encrypted",
  local_only: "local only",
  local_preferred: "prefers a local provider",
  s4_isolated: "local only, isolated",
};

export type ClaimStatusInput = {
  verification_state: string;
  lifecycle: string;
  handling_policy: string;
};

/**
 * Builds a one-line status sentence for a claim, e.g.
 * "Confirmed - kept permanently - cloud allowed if encrypted".
 */
export function claimStatusSentence(claim: ClaimStatusInput): string {
  return [
    labelFor(VERIFICATION_LABELS, claim.verification_state),
    labelFor(LIFECYCLE_STATUS_PHRASES, claim.lifecycle),
    labelFor(HANDLING_POLICY_PHRASES, claim.handling_policy),
  ].join(" - ");
}

export type AuditCategory = "memory" | "actions" | "security" | "system";

export const AUDIT_CATEGORY_LABELS: Record<AuditCategory, string> = {
  memory: "Memory",
  actions: "Actions",
  security: "Security",
  system: "System",
};

export const AUDIT_CATEGORY_EVENT_TYPES: Record<AuditCategory, string[]> = {
  memory: ["memory_confirmed", "memory_rejected", "memory_superseded", "memory_retracted"],
  actions: ["action_executed", "action_blocked", "action_rolled_back"],
  security: [
    "sensitivity_violation",
    "circuit_breaker_tripped",
    "payload_sensitivity_warning",
    "taint_escalation",
    "security_event",
    "manual_override",
  ],
  system: ["turn_processed"],
};

export function categoryForEventType(eventType: string): AuditCategory | null {
  const entry = (Object.entries(AUDIT_CATEGORY_EVENT_TYPES) as [AuditCategory, string[]][]).find(
    ([, types]) => types.includes(eventType),
  );
  return entry ? entry[0] : null;
}

export function humanizeSnakeCase(value: string): string {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

export function labelFor(map: Record<string, string>, key: string): string {
  return map[key] ?? humanizeSnakeCase(key);
}
