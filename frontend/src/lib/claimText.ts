const GENERIC_SUBJECTS = new Set(["user", "assistant", "nutzer", "benutzer", "ozymandias"]);

function capitalize(value: string): string {
  return value.length > 0 ? value.slice(0, 1).toUpperCase() + value.slice(1) : value;
}

export type ClaimTextInput = {
  subject: string;
  attribute?: string | null;
  value: string;
  content: string;
};

/**
 * Builds a short, human-readable sentence from a claim's raw fields, e.g.
 * "Name: Manfred Fritsch" or "Health: gluten intolerance". Falls back to the
 * free-text `content` field when subject/value are not descriptive enough.
 */
export function claimSentence(claim: ClaimTextInput): string {
  const subject = claim.subject?.trim();
  const attribute = claim.attribute?.trim();
  const value = claim.value?.trim();

  if (!value) {
    return claim.content?.trim() || "No details available.";
  }

  const label = !subject || GENERIC_SUBJECTS.has(subject.toLowerCase()) ? attribute || subject : subject;

  if (!label) {
    return value;
  }

  return `${capitalize(label)}: ${value}`;
}
