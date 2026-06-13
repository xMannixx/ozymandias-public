import { act, renderHook } from "@testing-library/react";
import { useDashboard } from "@/hooks/useDashboard";
import { mockDashboardStats } from "@/test/fixtures";

const getDashboardStatsMock = vi.fn();

vi.mock("@/api/stats", () => ({
  getDashboardStats: (...args: unknown[]) => getDashboardStatsMock(...args),
}));

describe("useDashboard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    getDashboardStatsMock.mockResolvedValue(mockDashboardStats);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function flush(): Promise<void> {
    await act(async () => {
      await Promise.resolve();
    });
  }

  it("loads stats on mount", async () => {
    const { result } = renderHook(() => useDashboard());

    await flush();
    expect(result.current.stats?.claims_total).toBe(mockDashboardStats.claims_total);
    expect(getDashboardStatsMock).toHaveBeenCalledTimes(1);
  });

  it("autoRefresh triggers refetch every 30 seconds", async () => {
    renderHook(() => useDashboard());
    await flush();
    getDashboardStatsMock.mockClear();

    await act(async () => {
      vi.advanceTimersByTime(30000);
    });
    await flush();

    expect(getDashboardStatsMock).toHaveBeenCalledTimes(1);
  });

  it("disabling autoRefresh stops interval calls", async () => {
    const { result } = renderHook(() => useDashboard());
    await flush();
    getDashboardStatsMock.mockClear();

    act(() => {
      result.current.setAutoRefresh(false);
    });

    await act(async () => {
      vi.advanceTimersByTime(60000);
    });
    await flush();

    expect(getDashboardStatsMock).not.toHaveBeenCalled();
  });

  it("handles invalid dashboard payload without crashing", async () => {
    getDashboardStatsMock.mockResolvedValueOnce({ claims_total: 1 });
    const { result } = renderHook(() => useDashboard());

    await flush();

    expect(result.current.stats).toBeNull();
    expect(result.current.error).toBe("Ungueltige Dashboard-Daten vom Server");
  });
});
