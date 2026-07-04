import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProposalList from "@/components/proposals/ProposalList";
import { mockProposalAutoConfirmed, mockProposalPending } from "@/test/fixtures";

const hookState = {
  visibleProposals: [mockProposalPending, mockProposalAutoConfirmed],
  loading: false,
  error: null as string | null,
  activeTab: "pending" as const,
  counts: { pending: 1, confirmed: 1, rejected: 0 },
  toast: null as { message: string; type: "success" | "error" | "info" } | null,
  setActiveTab: vi.fn(),
  approve: vi.fn(async () => undefined),
  reject: vi.fn(async () => undefined),
  clearToast: vi.fn(),
  refetch: vi.fn(async () => undefined),
  proposals: [mockProposalPending, mockProposalAutoConfirmed],
};

vi.mock("@/hooks/useProposals", () => ({
  useProposals: () => hookState,
}));

describe("ProposalList", () => {
  it("renders tab buttons with counts", () => {
    render(<ProposalList />);
    expect(screen.getByRole("button", { name: "Pending (1)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmed (1)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rejected (0)" })).toBeInTheDocument();
  });

  it("calls setActiveTab when tab is clicked", async () => {
    hookState.setActiveTab.mockClear();
    render(<ProposalList />);

    await userEvent.click(screen.getByRole("button", { name: "Confirmed (1)" }));
    expect(hookState.setActiveTab).toHaveBeenCalledWith("confirmed");
  });

  it("renders proposal cards from visible list", () => {
    render(<ProposalList />);
    expect(screen.getAllByText(/Ozymandias wants to remember:/)).toHaveLength(2);
  });

  it("shows a tab-specific empty state when no proposals are visible", () => {
    hookState.visibleProposals = [];
    render(<ProposalList />);
    expect(
      screen.getByText("Nothing waiting for review. New proposals from Ozymandias will show up here first."),
    ).toBeInTheDocument();
    hookState.visibleProposals = [mockProposalPending, mockProposalAutoConfirmed];
  });

  it("renders the review inbox explainer", () => {
    render(<ProposalList />);
    expect(screen.getByText("Review Inbox")).toBeInTheDocument();
  });
});
