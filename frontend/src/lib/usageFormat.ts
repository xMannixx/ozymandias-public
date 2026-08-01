/** Formatting helpers for usage numbers, shared by the page and the dashboard tile. */

const NOT_MEASURED = "—";

export function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}

/** Compact token counts, because six-digit numbers are hard to compare at a glance. */
export function formatTokens(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}k`;
  }
  return formatCount(value);
}

export function formatCost(value: number | null): string {
  if (value === null) {
    return NOT_MEASURED;
  }
  if (value === 0) {
    return "$0.00";
  }
  if (value < 0.01) {
    return `$${value.toFixed(4)}`;
  }
  return `$${value.toFixed(2)}`;
}

export function formatPercent(value: number | null, digits = 1): string {
  if (value === null) {
    return NOT_MEASURED;
  }
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatDecimal(value: number | null, digits = 1): string {
  if (value === null) {
    return NOT_MEASURED;
  }
  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatLatency(milliseconds: number | null): string {
  if (milliseconds === null) {
    return NOT_MEASURED;
  }
  if (milliseconds < 1000) {
    return `${Math.round(milliseconds)} ms`;
  }
  return `${(milliseconds / 1000).toFixed(1)} s`;
}

/** Axis label for one bucket: an hour within a day, or a calendar day. */
export function formatBucketLabel(isoValue: string, unit: "hour" | "day"): string {
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) {
    return isoValue;
  }
  if (unit === "hour") {
    return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
