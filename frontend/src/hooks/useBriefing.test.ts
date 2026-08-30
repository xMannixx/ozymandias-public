import { renderHook, waitFor } from "@testing-library/react";
import { useBriefing } from "@/hooks/useBriefing";
import { mockBriefing } from "@/test/fixtures";

const getLatestBriefingMock = vi.fn();

vi.mock("@/api/briefings", () => ({
  getLatestBriefing: () => getLatestBriefingMock(),
}));

describe("useBriefing", () => {
  beforeEach(() => {
    getLatestBriefingMock.mockReset();
    getLatestBriefingMock.mockResolvedValue(mockBriefing);
  });

  it("loads the latest briefing on mount", async () => {
    const { result } = renderHook(() => useBriefing());

    await waitFor(() => {
      expect(result.current.briefing).not.toBeNull();
    });
    expect(result.current.briefing?.sections).toHaveLength(2);
    expect(result.current.error).toBeNull();
  });

  it("treats a missing briefing as an empty state, not an error", async () => {
    getLatestBriefingMock.mockResolvedValue(null);

    const { result } = renderHook(() => useBriefing());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.briefing).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("rejects a response that is not a briefing", async () => {
    getLatestBriefingMock.mockResolvedValue("<!doctype html><html></html>");

    const { result } = renderHook(() => useBriefing());

    await waitFor(() => {
      expect(result.current.error).toBe("Invalid briefing data from server");
    });
    expect(result.current.briefing).toBeNull();
  });

  it("reports a failed request", async () => {
    getLatestBriefingMock.mockRejectedValue(new Error("network down"));

    const { result } = renderHook(() => useBriefing());

    await waitFor(() => {
      expect(result.current.error).toBe("network down");
    });
  });
});
