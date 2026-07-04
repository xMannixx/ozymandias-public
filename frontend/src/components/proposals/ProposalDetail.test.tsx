import { render, screen } from "@testing-library/react";
import ProposalDetail from "@/components/proposals/ProposalDetail";
import { mockProposalPending, mockProposalRejected } from "@/test/fixtures";

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
});
