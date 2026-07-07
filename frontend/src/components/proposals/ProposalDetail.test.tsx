import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ProposalDetail from "@/components/proposals/ProposalDetail";
import { mockProposalConfirmed, mockProposalPending, mockProposalRejected } from "@/test/fixtures";

describe("ProposalDetail", () => {
  it("renders the plain-language summary sentence", () => {
    render(<ProposalDetail proposal={mockProposalPending} />);
    expect(screen.getByText(/Ozymandias wants to remember:/)).toBeInTheDocument();
    expect(screen.getByText("Location: Vienna")).toBeInTheDocument();
  });

  it("explains what approving and rejecting do for pending proposals", () => {
    render(<ProposalDetail proposal={mockProposalPending} />);
    expect(screen.getByText(/Approving/)).toBeInTheDocument();
    expect(screen.getByText(/Rejecting/)).toBeInTheDocument();
  });

  it("shows the decision and reason for a rejected proposal", () => {
    render(<ProposalDetail proposal={mockProposalRejected} />);
    expect(screen.getByText(/Decision:/)).toBeInTheDocument();
    expect(screen.getByText(/Insufficient confidence\./)).toBeInTheDocument();
  });

  it("keeps raw fields available behind a technical details toggle", () => {
    render(<ProposalDetail proposal={mockProposalPending} />);
    expect(screen.getByText("Technical details")).toBeInTheDocument();
    expect(screen.getByText(/subject:/)).toBeInTheDocument();
  });

  it("links to Memory for a confirmed proposal", () => {
    render(
      <MemoryRouter>
        <ProposalDetail proposal={mockProposalConfirmed} />
      </MemoryRouter>,
    );
    const link = screen.getByRole("link", { name: "View in Memory" });
    expect(link).toHaveAttribute("href", expect.stringContaining("/memory?search="));
  });

  it("does not link to Memory for a pending proposal", () => {
    render(
      <MemoryRouter>
        <ProposalDetail proposal={mockProposalPending} />
      </MemoryRouter>,
    );
    expect(screen.queryByRole("link", { name: "View in Memory" })).not.toBeInTheDocument();
  });
});
