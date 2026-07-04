import { groupByDay } from "@/lib/dayGroups";

type Item = { id: string; created_at: string };

describe("groupByDay", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("groups items by calendar day preserving order", () => {
    const items: Item[] = [
      { id: "a", created_at: "2026-06-15T10:00:00Z" },
      { id: "b", created_at: "2026-06-15T08:00:00Z" },
      { id: "c", created_at: "2026-06-14T09:00:00Z" },
    ];

    const groups = groupByDay(items);
    expect(groups).toHaveLength(2);
    expect(groups[0].items.map((item) => item.id)).toEqual(["a", "b"]);
    expect(groups[1].items.map((item) => item.id)).toEqual(["c"]);
  });

  it("labels today and yesterday", () => {
    const items: Item[] = [
      { id: "a", created_at: "2026-06-15T10:00:00Z" },
      { id: "b", created_at: "2026-06-14T09:00:00Z" },
    ];

    const groups = groupByDay(items);
    expect(groups[0].label).toBe("Today");
    expect(groups[1].label).toBe("Yesterday");
  });

  it("labels older days with a full date", () => {
    const items: Item[] = [{ id: "a", created_at: "2026-06-01T09:00:00Z" }];
    const groups = groupByDay(items);
    expect(groups[0].label).toContain("2026");
    expect(groups[0].label).not.toBe("Today");
    expect(groups[0].label).not.toBe("Yesterday");
  });

  it("returns an empty array for no items", () => {
    expect(groupByDay([])).toEqual([]);
  });

  it("falls back to 'Unknown date' for unparsable timestamps", () => {
    const items: Item[] = [{ id: "a", created_at: "not-a-date" }];
    const groups = groupByDay(items);
    expect(groups[0].label).toBe("Unknown date");
  });
});
