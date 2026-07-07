import { claimSentence } from "@/lib/claimText";

describe("claimSentence", () => {
  it("builds a sentence from subject and value when subject is descriptive", () => {
    expect(claimSentence({ subject: "Name", attribute: null, value: "Manfred Fritsch", content: "" })).toBe(
      "Name: Manfred Fritsch",
    );
  });

  it("prefers the attribute as label when subject is a generic entity", () => {
    expect(
      claimSentence({ subject: "user", attribute: "health", value: "gluten intolerance", content: "" }),
    ).toBe("Health: gluten intolerance");
  });

  it("falls back to subject when attribute is missing and subject is generic", () => {
    expect(claimSentence({ subject: "user", attribute: null, value: "dark mode", content: "" })).toBe(
      "User: dark mode",
    );
  });

  it("falls back to content when value is empty", () => {
    expect(claimSentence({ subject: "user", attribute: null, value: "", content: "Free text note." })).toBe(
      "Free text note.",
    );
  });

  it("falls back to a generic message when both value and content are empty", () => {
    expect(claimSentence({ subject: "user", attribute: null, value: "", content: "" })).toBe(
      "No details available.",
    );
  });
});
