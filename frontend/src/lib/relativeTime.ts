export function toRelativeTime(isoValue: string | null | undefined): string {
  if (!isoValue) {
    return "unknown time";
  }
  const createdAt = new Date(isoValue).getTime();
  if (Number.isNaN(createdAt)) {
    return "unknown time";
  }
  const deltaSeconds = Math.max(0, Math.floor((Date.now() - createdAt) / 1000));

  if (deltaSeconds < 60) {
    return "just now";
  }
  const deltaMinutes = Math.floor(deltaSeconds / 60);
  if (deltaMinutes < 60) {
    return `${deltaMinutes} min ago`;
  }
  const deltaHours = Math.floor(deltaMinutes / 60);
  if (deltaHours < 24) {
    return `${deltaHours} hr${deltaHours === 1 ? "" : "s"} ago`;
  }
  const deltaDays = Math.floor(deltaHours / 24);
  return `${deltaDays} day${deltaDays === 1 ? "" : "s"} ago`;
}
