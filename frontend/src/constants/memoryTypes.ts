export const MEMORY_TYPE_LABELS: Record<string, string> = {
  profile: "Profil",
  health: "Gesundheit",
  preference: "Vorliebe",
  relationship: "Beziehung",
  event: "Ereignis",
  location: "Ort",
  work: "Arbeit",
  finance: "Finanzen",
  security: "Sicherheit",
  intimate: "Intim",
};

export const MEMORY_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "Alle" },
  { value: "profile", label: MEMORY_TYPE_LABELS.profile },
  { value: "health", label: MEMORY_TYPE_LABELS.health },
  { value: "preference", label: MEMORY_TYPE_LABELS.preference },
  { value: "relationship", label: MEMORY_TYPE_LABELS.relationship },
  { value: "event", label: MEMORY_TYPE_LABELS.event },
  { value: "location", label: MEMORY_TYPE_LABELS.location },
  { value: "work", label: MEMORY_TYPE_LABELS.work },
  { value: "finance", label: MEMORY_TYPE_LABELS.finance },
  { value: "security", label: MEMORY_TYPE_LABELS.security },
  { value: "intimate", label: MEMORY_TYPE_LABELS.intimate },
];
