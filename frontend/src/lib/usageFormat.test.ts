import {
  formatCost,
  formatCount,
  formatDecimal,
  formatLatency,
  formatPercent,
  formatTokens,
} from "@/lib/usageFormat";

describe("usageFormat", () => {
  it("shortens large token counts", () => {
    expect(formatTokens(842)).toBe("842");
    expect(formatTokens(1_500)).toBe("1.5k");
    expect(formatTokens(24_000)).toBe("24k");
    expect(formatTokens(1_250_000)).toBe("1.3M");
  });

  it("keeps small costs readable instead of rounding them to zero", () => {
    expect(formatCost(0)).toBe("$0.00");
    expect(formatCost(0.0004)).toBe("$0.0004");
    expect(formatCost(1.239)).toBe("$1.24");
  });

  it("says nothing was measured rather than showing a zero", () => {
    expect(formatCost(null)).toBe("—");
    expect(formatPercent(null)).toBe("—");
    expect(formatDecimal(null)).toBe("—");
    expect(formatLatency(null)).toBe("—");
  });

  it("formats rates and latencies", () => {
    expect(formatPercent(0.1234)).toBe("12.3%");
    expect(formatLatency(420)).toBe("420 ms");
    expect(formatLatency(2500)).toBe("2.5 s");
    expect(formatCount(12345)).toBe("12,345");
  });
});
