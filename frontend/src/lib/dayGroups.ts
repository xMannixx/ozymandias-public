export type DayGroup<T> = {
  key: string;
  label: string;
  items: T[];
};

function dayKey(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "unknown";
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dayLabel(key: string): string {
  if (key === "unknown") {
    return "Unknown date";
  }
  const today = dayKey(new Date().toISOString());
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = dayKey(yesterdayDate.toISOString());

  if (key === today) {
    return "Today";
  }
  if (key === yesterday) {
    return "Yesterday";
  }

  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Groups items (already sorted, typically newest first) into day buckets
 * with friendly labels ("Today", "Yesterday", or a full date).
 */
export function groupByDay<T extends { created_at: string }>(items: T[]): DayGroup<T>[] {
  const groups = new Map<string, T[]>();
  items.forEach((item) => {
    const key = dayKey(item.created_at);
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  });

  return Array.from(groups.entries()).map(([key, groupItems]) => ({
    key,
    label: dayLabel(key),
    items: groupItems,
  }));
}
