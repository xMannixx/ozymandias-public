import { act, renderHook, waitFor } from "@testing-library/react";
import { ApiError } from "@/api/client";
import type { ClaimVersionResponse } from "@/api/types";
import { useClaims } from "@/hooks/useClaims";
import {
  mockClaimArchived,
  mockClaimLocked,
  mockClaimS0,
  mockClaimS4,
  mockClaimTentative,
  mockClaimVersions,
} from "@/test/fixtures";

const listClaimsMock = vi.fn();
const getClaimVersionsMock = vi.fn();
const confirmClaimMock = vi.fn();
const retractClaimMock = vi.fn();
const archiveClaimMock = vi.fn();
const lockClaimMock = vi.fn();
const unlockClaimMock = vi.fn();
const updateSensitivityMock = vi.fn();

vi.mock("@/api/claims", () => ({
  listClaims: (...args: unknown[]) => listClaimsMock(...args),
  getClaimVersions: (...args: unknown[]) => getClaimVersionsMock(...args),
  confirmClaim: (...args: unknown[]) => confirmClaimMock(...args),
  retractClaim: (...args: unknown[]) => retractClaimMock(...args),
  archiveClaim: (...args: unknown[]) => archiveClaimMock(...args),
  lockClaim: (...args: unknown[]) => lockClaimMock(...args),
  unlockClaim: (...args: unknown[]) => unlockClaimMock(...args),
  updateClaimSensitivity: (...args: unknown[]) => updateSensitivityMock(...args),
}));

function createDeferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
}

describe("useClaims", () => {
  beforeEach(() => {
    listClaimsMock.mockResolvedValue([mockClaimTentative, mockClaimS4, mockClaimS0]);
    getClaimVersionsMock.mockResolvedValue(mockClaimVersions);
    confirmClaimMock.mockResolvedValue({ ...mockClaimTentative, verification_state: "confirmed" });
    retractClaimMock.mockResolvedValue({ claim_id: mockClaimTentative.claim_id, status: "retracted" });
    archiveClaimMock.mockResolvedValue({ claim_id: mockClaimTentative.claim_id, status: "archived" });
    lockClaimMock.mockResolvedValue(mockClaimLocked);
    unlockClaimMock.mockResolvedValue(mockClaimTentative);
    updateSensitivityMock.mockResolvedValue({ ...mockClaimTentative, sensitivity: "S4" });
  });

  it("loads claims on mount", async () => {
    const { result } = renderHook(() => useClaims());

    await waitFor(() => {
      expect(result.current.claims).toHaveLength(3);
    });
    expect(listClaimsMock).toHaveBeenCalledTimes(1);
  });

  it("does not refetch full claim list when selecting a claim", async () => {
    const { result } = renderHook(() => useClaims());
    await waitFor(() => expect(result.current.claims).toHaveLength(3));
    listClaimsMock.mockClear();

    await act(async () => {
      await result.current.selectClaim(mockClaimTentative);
    });

    expect(listClaimsMock).not.toHaveBeenCalled();
  });

  it("refetch updates selected claim from refreshed list", async () => {
    const { result } = renderHook(() => useClaims());
    await waitFor(() => expect(result.current.claims).toHaveLength(3));
    await act(async () => {
      await result.current.selectClaim(mockClaimTentative);
    });

    const updatedList = [{ ...mockClaimTentative, value: "synced-from-server" }, mockClaimS4, mockClaimS0];
    listClaimsMock.mockResolvedValueOnce(updatedList);

    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.selectedClaim?.value).toBe("synced-from-server");
  });

  it("filters claims by selected sensitivity", async () => {
    const { result } = renderHook(() => useClaims());
    await waitFor(() => expect(result.current.claims).toHaveLength(3));

    act(() => {
      result.current.setFilters((current) => ({ ...current, sensitivities: ["S4"] }));
    });

    expect(result.current.filteredClaims).toHaveLength(1);
    expect(result.current.filteredClaims[0].sensitivity).toBe("S4");
  });

  it("filters claims by search query on client side", async () => {
    const { result } = renderHook(() => useClaims());
    await waitFor(() => expect(result.current.claims).toHaveLength(3));

    act(() => {
      result.current.setSearchQuery("Ozymandias");
    });

    expect(result.current.filteredClaims).toHaveLength(1);
    expect(result.current.filteredClaims[0].claim_id).toBe(mockClaimS0.claim_id);
  });

  it("loads versions when selecting a claim", async () => {
    const versionsDeferred = createDeferred<ClaimVersionResponse[]>();
    getClaimVersionsMock.mockReturnValueOnce(versionsDeferred.promise);
    const { result } = renderHook(() => useClaims());
    await waitFor(() => expect(result.current.claims).toHaveLength(3));

    let selectPromise: Promise<void>;
    await act(async () => {
      selectPromise = result.current.selectClaim(mockClaimTentative);
    });

    expect(result.current.versionsLoading).toBe(true);
    expect(result.current.versions).toEqual([]);

    await act(async () => {
      versionsDeferred.resolve(mockClaimVersions);
      await selectPromise;
    });

    expect(getClaimVersionsMock).toHaveBeenCalledWith(mockClaimTentative.claim_id);
    expect(result.current.versions).toHaveLength(3);
    expect(result.current.versionsLoading).toBe(false);
  });

  it("ignores stale versions response when switching claims quickly", async () => {
    const firstDeferred = createDeferred<ClaimVersionResponse[]>();
    const secondDeferred = createDeferred<ClaimVersionResponse[]>();
    getClaimVersionsMock
      .mockReturnValueOnce(firstDeferred.promise)
      .mockReturnValueOnce(secondDeferred.promise);

    const { result } = renderHook(() => useClaims());
    await waitFor(() => expect(result.current.claims).toHaveLength(3));

    await act(async () => {
      void result.current.selectClaim(mockClaimTentative);
      void result.current.selectClaim(mockClaimS4);
    });

    expect(result.current.selectedClaim?.claim_id).toBe(mockClaimS4.claim_id);
    expect(result.current.versionsLoading).toBe(true);
    expect(result.current.versions).toEqual([]);

    await act(async () => {
      firstDeferred.resolve([mockClaimVersions[0]]);
      await Promise.resolve();
    });

    expect(result.current.versions).toEqual([]);
    expect(result.current.versionsLoading).toBe(true);

    const secondVersions = [mockClaimVersions[1]];
    await act(async () => {
      secondDeferred.resolve(secondVersions);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.versions).toEqual(secondVersions);
      expect(result.current.versionsLoading).toBe(false);
    });
  });

  it("updates state after confirm mutation", async () => {
    const { result } = renderHook(() => useClaims());
    await waitFor(() => expect(result.current.claims).toHaveLength(3));

    await act(async () => {
      await result.current.confirmClaim(mockClaimTentative.claim_id);
    });

    expect(result.current.toast?.type).toBe("success");
  });

  it("marks claim as retracted in local state", async () => {
    const { result } = renderHook(() => useClaims());
    await waitFor(() => expect(result.current.claims).toHaveLength(3));

    await act(async () => {
      await result.current.retractClaim(mockClaimTentative.claim_id);
    });

    const updated = result.current.claims.find((item) => item.claim_id === mockClaimTentative.claim_id);
    expect(updated?.verification_state).toBe("retracted");
  });

  it("sets lifecycle archived after archive mutation", async () => {
    listClaimsMock.mockResolvedValue([mockClaimArchived]);
    const { result } = renderHook(() => useClaims());
    await waitFor(() => expect(result.current.claims).toHaveLength(1));

    await act(async () => {
      await result.current.archiveClaim(mockClaimArchived.claim_id);
    });

    const updated = result.current.claims.find((item) => item.claim_id === mockClaimArchived.claim_id);
    expect(updated?.lifecycle).toBe("archived");
  });

  it("shows conflict toast when mutation returns 409", async () => {
    lockClaimMock.mockRejectedValue(new ApiError("already locked", 409, { detail: "already locked" }));
    const { result } = renderHook(() => useClaims());
    await waitFor(() => expect(result.current.claims).toHaveLength(3));

    await act(async () => {
      await result.current.lockClaim(mockClaimTentative.claim_id);
    });

    expect(result.current.toast?.message).toContain("Konflikt");
  });
});
