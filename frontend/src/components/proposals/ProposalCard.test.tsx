import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProposalCard from "@/components/proposals/ProposalCard";
import { mockProposalAutoConfirmed, mockProposalPending } from "@/test/fixtures";

function baseHandlers() {
  return {
    onSelect: vi.fn(),
    onApprove: vi.fn(async () => undefined),
    onReject: vi.fn(async () => undefined),
  };
}

describe("ProposalCard", () => {
  it("renders proposed subject and value", () => {
    const handlers = baseHandlers();
    render(<ProposalCard proposal={mockProposalPending} isSelected={false} {...handlers} />);

    expect(screen.getByText(mockProposalPending.proposed_claim.subject)).toBeInTheDocument();
    expect(screen.getByText(mockProposalPending.proposed_claim.value)).toBeInTheDocument();
  });

  it("renders status badge", () => {
    const handlers = baseHandlers();
    render(<ProposalCard proposal={mockProposalPending} isSelected={false} {...handlers} />);
    expect(screen.getByText(mockProposalPending.status)).toBeInTheDocument();
  });

  it("renders auto badge for auto_confirmed status", () => {
    const handlers = baseHandlers();
    render(<ProposalCard proposal={mockProposalAutoConfirmed} isSelected={false} {...handlers} />);
    expect(screen.getByText("Auto")).toBeInTheDocument();
  });

  it("calls onSelect when card header is clicked", async () => {
    const handlers = baseHandlers();
    render(<ProposalCard proposal={mockProposalPending} isSelected={false} {...handlers} />);

    await userEvent.click(screen.getByText(mockProposalPending.proposed_claim.subject));
    expect(handlers.onSelect).toHaveBeenCalledWith(mockProposalPending);
  });

  it("includes actions for pending proposal", () => {
    const handlers = baseHandlers();
    render(<ProposalCard proposal={mockProposalPending} isSelected={false} {...handlers} />);
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument();
  });

  it("shows selected class when selected", () => {
    const handlers = baseHandlers();
    const { container } = render(<ProposalCard proposal={mockProposalPending} isSelected {...handlers} />);
    expect(container.firstChild).toHaveClass("neon-glow-blue");
  });

  it("renders sensitivity badge from proposed claim", () => {
    const handlers = baseHandlers();
    render(<ProposalCard proposal={mockProposalPending} isSelected={false} {...handlers} />);
    expect(screen.getByText(mockProposalPending.proposed_claim.sensitivity)).toBeInTheDocument();
  });
});
