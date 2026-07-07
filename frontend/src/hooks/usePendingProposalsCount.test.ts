import { renderHook, waitFor } from "@testing-library/react";
import { usePendingProposalsCount } from "@/hooks/usePendingProposalsCount";

const listProposalsMock = vi.fn();

vi.mock("@/api/proposals", () => ({
  listProposals: (...args: unknown[]) => listProposalsMock(...args),
}));

describe("usePendingProposalsCount", () => {
  beforeEach(() => {
    listProposalsMock.mockReset();
  });

  it("starts at 0 and updates once the pending count resolves", async () => {
    listProposalsMock.mockResolvedValue([{}, {}]);
    const { result } = renderHook(() => usePendingProposalsCount());

    expect(result.current).toBe(0);
    await waitFor(() => expect(result.current).toBe(2));
    expect(listProposalsMock).toHaveBeenCalledWith({ status: "pending" });
  });

  it("stays at 0 when the request fails", async () => {
    listProposalsMock.mockRejectedValue(new Error("network error"));
    const { result } = renderHook(() => usePendingProposalsCount());

    await waitFor(() => expect(listProposalsMock).toHaveBeenCalled());
    expect(result.current).toBe(0);
  });
});
