import { AUDIT_EVENT_LABELS, labelFor } from "@/lib/labels";
import type { AuditEntryResponse } from "@/api/types";

function payloadHint(payload: Record<string, unknown> | null): string | null {
  if (!payload) {
    return null;
  }
  if (typeof payload.provider === "string" && payload.provider) {
    return `via ${payload.provider}`;
  }
  if (typeof payload.reason === "string" && payload.reason) {
    return `(${payload.reason})`;
  }
  if (typeof payload.note === "string" && payload.note) {
    return `(${payload.note})`;
  }
  return null;
}

/**
 * Builds a short, human-readable sentence for an audit entry, e.g.
 * "Chat message processed via deepseek" or "Memory confirmed".
 */
export function auditSentence(entry: AuditEntryResponse): string {
  const label = labelFor(AUDIT_EVENT_LABELS, entry.event_type);
  const hint = payloadHint(entry.payload);
  return hint ? `${label} ${hint}` : label;
}
