import { toRelativeTime } from "@/lib/relativeTime";

describe("toRelativeTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'just now' for very recent timestamps", () => {
    expect(toRelativeTime("2026-06-15T11:59:50Z")).toBe("just now");
  });

  it("returns minutes for timestamps under an hour old", () => {
    expect(toRelativeTime("2026-06-15T11:55:00Z")).toBe("5 min ago");
  });

  it("returns hours for timestamps under a day old", () => {
    expect(toRelativeTime("2026-06-15T09:00:00Z")).toBe("3 hrs ago");
  });

  it("uses singular hour when exactly one hour ago", () => {
    expect(toRelativeTime("2026-06-15T11:00:00Z")).toBe("1 hr ago");
  });

  it("returns days for older timestamps", () => {
    expect(toRelativeTime("2026-06-12T12:00:00Z")).toBe("3 days ago");
  });

  it("returns a fallback for missing or invalid values", () => {
    expect(toRelativeTime(null)).toBe("unknown time");
    expect(toRelativeTime("not-a-date")).toBe("unknown time");
  });
});
