import { describe, expect, it } from "vitest";
import { auditSentence } from "@/lib/auditText";
import type { AuditEntryResponse } from "@/api/types";

function makeEntry(overrides: Partial<AuditEntryResponse>): AuditEntryResponse {
  return {
    audit_id: "audit-1",
    event_type: "turn_processed",
    user_id: "user-1",
    channel: "web",
    payload: null,
    source_ref: null,
    result: "success",
    sensitivity: "S0",
    created_at: "2026-04-06T12:00:00Z",
    ...overrides,
  };
}

describe("auditSentence", () => {
  it("builds a plain label when there is no payload", () => {
    expect(auditSentence(makeEntry({ event_type: "memory_confirmed", payload: null }))).toBe("Memory confirmed");
  });

  it("appends the provider when present in the payload", () => {
    expect(
      auditSentence(makeEntry({ event_type: "turn_processed", payload: { provider: "deepseek" } })),
    ).toBe("Chat message processed via deepseek");
  });

  it("appends a reason hint when present in the payload", () => {
    expect(
      auditSentence(makeEntry({ event_type: "action_blocked", payload: { reason: "sensitivity too high" } })),
    ).toBe("Action blocked (sensitivity too high)");
  });

  it("falls back to a humanized event type for unknown events", () => {
    expect(auditSentence(makeEntry({ event_type: "custom_thing_happened", payload: null }))).toBe(
      "Custom Thing Happened",
    );
  });
});
