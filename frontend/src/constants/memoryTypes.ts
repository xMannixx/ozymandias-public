export const MEMORY_TYPE_LABELS: Record<string, string> = {
  profile: "Profile",
  health: "Health",
  preference: "Preference",
  relationship: "Relationship",
  event: "Event",
  location: "Location",
  work: "Work",
  finance: "Finance",
  security: "Security",
  intimate: "Intimate",
};

export const MEMORY_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "All" },
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
