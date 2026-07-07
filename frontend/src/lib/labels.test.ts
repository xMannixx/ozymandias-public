import { categoryForEventType, claimStatusSentence, humanizeSnakeCase, labelFor, SENSITIVITY_LABELS } from "@/lib/labels";

describe("labels", () => {
  it("provides a human label for every sensitivity level", () => {
    expect(SENSITIVITY_LABELS.S0).toBe("Public");
    expect(SENSITIVITY_LABELS.S4).toBe("Intimate");
  });

  it("humanizeSnakeCase turns snake_case into Title Case words", () => {
    expect(humanizeSnakeCase("memory_confirmed")).toBe("Memory Confirmed");
  });

  it("labelFor falls back to humanized key when missing from the map", () => {
    expect(labelFor({ known: "Known Label" }, "known")).toBe("Known Label");
    expect(labelFor({ known: "Known Label" }, "some_unknown_key")).toBe("Some Unknown Key");
  });

  it("categoryForEventType maps known event types to their category", () => {
    expect(categoryForEventType("memory_confirmed")).toBe("memory");
    expect(categoryForEventType("action_blocked")).toBe("actions");
    expect(categoryForEventType("sensitivity_violation")).toBe("security");
    expect(categoryForEventType("turn_processed")).toBe("system");
  });

  it("categoryForEventType returns null for unknown event types", () => {
    expect(categoryForEventType("something_unknown")).toBeNull();
  });

  it("claimStatusSentence builds a readable status line", () => {
    expect(
      claimStatusSentence({
        verification_state: "confirmed",
        lifecycle: "permanent",
        handling_policy: "cloud_ok_encrypted",
      }),
    ).toBe("Confirmed - kept permanently - cloud allowed if encrypted");
  });
});
