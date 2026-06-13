import { act, renderHook, waitFor } from "@testing-library/react";
import { useAudit } from "@/hooks/useAudit";
import { mockAuditList } from "@/test/fixtures";

const listAuditEntriesMock = vi.fn();

vi.mock("@/api/audit", () => ({
  listAuditEntries: (...args: unknown[]) => listAuditEntriesMock(...args),
}));

describe("useAudit", () => {
  beforeEach(() => {
    listAuditEntriesMock.mockResolvedValue({
      entries: mockAuditList,
      total: 99,
      limit: 50,
      offset: 0,
    });
  });

  it("loads entries on mount", async () => {
    const { result } = renderHook(() => useAudit());

    await waitFor(() => {
      expect(result.current.entries).toHaveLength(10);
    });
    expect(listAuditEntriesMock).toHaveBeenCalledTimes(1);
  });

  it("setFilters triggers API call with query params", async () => {
    const { result } = renderHook(() => useAudit());
    await waitFor(() => expect(result.current.entries).toHaveLength(10));
    listAuditEntriesMock.mockClear();

    await act(async () => {
      result.current.setFilters((current) => ({
        ...current,
        event_type: "memory_confirmed",
      }));
    });

    await waitFor(() => expect(listAuditEntriesMock).toHaveBeenCalled());
    expect(listAuditEntriesMock.mock.calls.at(-1)?.[0]).toMatchObject({
      event_type: "memory_confirmed",
      offset: 0,
      limit: 50,
    });
  });

  it("setPage calculates offset correctly", async () => {
    const { result } = renderHook(() => useAudit());
    await waitFor(() => expect(result.current.entries).toHaveLength(10));
    listAuditEntriesMock.mockClear();

    await act(async () => {
      result.current.setPage(3);
    });

    await waitFor(() => expect(listAuditEntriesMock).toHaveBeenCalled());
    expect(listAuditEntriesMock.mock.calls.at(-1)?.[0]).toMatchObject({
      offset: 100,
      limit: 50,
    });
  });

  it("showS4 toggle sends sensitivity S4", async () => {
    const { result } = renderHook(() => useAudit());
    await waitFor(() => expect(result.current.entries).toHaveLength(10));
    listAuditEntriesMock.mockClear();

    await act(async () => {
      result.current.setShowS4(true);
    });

    await waitFor(() => expect(listAuditEntriesMock).toHaveBeenCalled());
    expect(listAuditEntriesMock.mock.calls.at(-1)?.[0]).toMatchObject({ sensitivity: "S4" });
  });

  it("keeps total from response", async () => {
    const { result } = renderHook(() => useAudit());

    await waitFor(() => {
      expect(result.current.total).toBe(99);
    });
  });
});
