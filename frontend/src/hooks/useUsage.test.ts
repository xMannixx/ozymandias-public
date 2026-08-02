import { renderHook, waitFor } from "@testing-library/react";
import { useUsage } from "@/hooks/useUsage";
import { mockUsageReport } from "@/test/fixtures";

const getUsageReportMock = vi.fn();

vi.mock("@/api/usage", () => ({
  getUsageReport: (...args: unknown[]) => getUsageReportMock(...args),
}));

describe("useUsage", () => {
  beforeEach(() => {
    getUsageReportMock.mockReset();
    getUsageReportMock.mockResolvedValue(mockUsageReport);
  });

  it("loads the default range on mount", async () => {
    const { result } = renderHook(() => useUsage());

    await waitFor(() => {
      expect(result.current.report).not.toBeNull();
    });
    expect(getUsageReportMock).toHaveBeenCalledWith("24h");
  });

  it("rejects a response that is not a usage report", async () => {
    getUsageReportMock.mockResolvedValue("<!doctype html><html></html>");
    const { result } = renderHook(() => useUsage());

    await waitFor(() => {
      expect(result.current.error).toBe("Invalid usage data from server");
    });
    expect(result.current.report).toBeNull();
  });
});
