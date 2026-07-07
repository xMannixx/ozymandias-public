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
  it("renders a plain-language sentence describing what will be remembered", () => {
    const handlers = baseHandlers();
    render(<ProposalCard proposal={mockProposalPending} isSelected={false} {...handlers} />);

    expect(screen.getByText(/Ozymandias wants to remember:/)).toBeInTheDocument();
    expect(screen.getByText("Location: Vienna")).toBeInTheDocument();
  });

  it("renders a labelled sensitivity chip", () => {
    const handlers = baseHandlers();
    render(<ProposalCard proposal={mockProposalPending} isSelected={false} {...handlers} />);
    expect(screen.getAllByText(/S1/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/General/).length).toBeGreaterThan(0);
  });

  it("renders auto badge for auto_confirmed status", () => {
    const handlers = baseHandlers();
    render(<ProposalCard proposal={mockProposalAutoConfirmed} isSelected={false} {...handlers} />);
    expect(screen.getByText("Auto")).toBeInTheDocument();
  });

  it("renders relative creation time", () => {
    const handlers = baseHandlers();
    render(<ProposalCard proposal={mockProposalPending} isSelected={false} {...handlers} />);
    expect(screen.getByText(/ago|just now/)).toBeInTheDocument();
  });

  it("calls onSelect when card body is clicked", async () => {
    const handlers = baseHandlers();
    render(<ProposalCard proposal={mockProposalPending} isSelected={false} {...handlers} />);

    await userEvent.click(screen.getByText(/Ozymandias wants to remember:/));
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
});
