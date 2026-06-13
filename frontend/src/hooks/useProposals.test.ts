import { act, renderHook, waitFor } from "@testing-library/react";
import { ApiError } from "@/api/client";
import { useProposals } from "@/hooks/useProposals";
import {
  mockProposalAutoConfirmed,
  mockProposalConfirmed,
  mockProposalPending,
  mockProposalRejected,
} from "@/test/fixtures";

const listProposalsMock = vi.fn();
const approveProposalMock = vi.fn();
const rejectProposalMock = vi.fn();

vi.mock("@/api/proposals", () => ({
  listProposals: (...args: unknown[]) => listProposalsMock(...args),
  approveProposal: (...args: unknown[]) => approveProposalMock(...args),
  rejectProposal: (...args: unknown[]) => rejectProposalMock(...args),
}));

describe("useProposals", () => {
  beforeEach(() => {
    listProposalsMock.mockResolvedValue([mockProposalPending, mockProposalConfirmed, mockProposalAutoConfirmed]);
    approveProposalMock.mockResolvedValue(mockProposalConfirmed);
    rejectProposalMock.mockResolvedValue(mockProposalRejected);
  });

  it("loads proposals on mount", async () => {
    const { result } = renderHook(() => useProposals());

    await waitFor(() => {
      expect(result.current.proposals).toHaveLength(3);
    });
    expect(listProposalsMock).toHaveBeenCalledWith();
  });

  it("filters visible proposals when tab changes", async () => {
    const { result } = renderHook(() => useProposals());
    await waitFor(() => expect(result.current.proposals).toHaveLength(3));

    act(() => {
      result.current.setActiveTab("confirmed");
    });

    expect(result.current.visibleProposals).toHaveLength(2);
    expect(result.current.visibleProposals[0].status).toMatch(/confirmed|auto_confirmed/);
  });

  it("counts auto_confirmed under confirmed tab", async () => {
    const { result } = renderHook(() => useProposals());
    await waitFor(() => expect(result.current.counts.confirmed).toBe(2));
  });

  it("updates proposal after approve", async () => {
    const { result } = renderHook(() => useProposals());
    await waitFor(() => expect(result.current.proposals).toHaveLength(3));

    await act(async () => {
      await result.current.approve(mockProposalPending.proposal_id);
    });

    expect(result.current.toast?.type).toBe("success");
  });

  it("updates proposal after reject", async () => {
    const { result } = renderHook(() => useProposals());
    await waitFor(() => expect(result.current.proposals).toHaveLength(3));

    await act(async () => {
      await result.current.reject(mockProposalPending.proposal_id, "duplicate");
    });

    expect(result.current.toast?.type).toBe("success");
  });

  it("handles 409 conflicts with toast", async () => {
    approveProposalMock.mockRejectedValue(new ApiError("already decided", 409, { detail: "already decided" }));
    const { result } = renderHook(() => useProposals());
    await waitFor(() => expect(result.current.proposals).toHaveLength(3));

    await act(async () => {
      await result.current.approve(mockProposalPending.proposal_id);
    });

    expect(result.current.toast?.message).toContain("Konflikt");
  });

  it("surfaces error for invalid proposals response shape", async () => {
    listProposalsMock.mockResolvedValueOnce({ proposals: [mockProposalPending] });
    const { result } = renderHook(() => useProposals());

    await waitFor(() => {
      expect(result.current.error).toBe("Ungueltige Proposals-Antwort vom Server");
    });
  });
});
