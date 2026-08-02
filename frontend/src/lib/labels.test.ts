import {
  categoryForEventType,
  claimStatusSentence,
  codeWithLabel,
  confidenceDescription,
  confidenceLabel,
  humanizeSnakeCase,
  labelFor,
  optionsWithAll,
  SENSITIVITY_LABELS,
  VERIFICATION_LABELS,
  VERIFICATION_ORDER,
} from "@/lib/labels";

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

  it("codeWithLabel pairs a raw code with its plain-language label", () => {
    expect(codeWithLabel(SENSITIVITY_LABELS, "S2")).toBe("S2 · Personal");
    expect(codeWithLabel(SENSITIVITY_LABELS, "S9")).toBe("S9");
  });

  it("optionsWithAll puts an All entry first and uses readable labels", () => {
    const options = optionsWithAll(VERIFICATION_LABELS, VERIFICATION_ORDER);
    expect(options[0]).toEqual({ value: "", label: "All" });
    expect(options).toContainEqual({ value: "tentative", label: "Needs review" });
  });

  it("confidenceLabel describes the score in words", () => {
    expect(confidenceLabel(0.95)).toBe("Very sure");
    expect(confidenceLabel(0.7)).toBe("Fairly sure");
    expect(confidenceLabel(0.5)).toBe("Unsure");
    expect(confidenceLabel(0.1)).toBe("Very unsure");
  });

  it("confidenceDescription explains the score and includes the percentage", () => {
    expect(confidenceDescription(0.31)).toContain("31%");
    expect(confidenceDescription(0.31)).toMatch(/low confidence/i);
  });
});
