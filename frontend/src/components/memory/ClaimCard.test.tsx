import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ClaimCard from "@/components/memory/ClaimCard";
import {
  mockClaimArchived,
  mockClaimLocked,
  mockClaimLowConfidence,
  mockClaimReviewDue,
  mockClaimS4,
} from "@/test/fixtures";

describe("ClaimCard", () => {
  it("renders a plain-language sentence as the primary line", () => {
    render(<ClaimCard claim={mockClaimS4} isSelected={false} onSelect={() => undefined} />);
    expect(screen.getByText("Relationship: private")).toBeInTheDocument();
  });

  it("renders a labelled sensitivity chip", () => {
    render(<ClaimCard claim={mockClaimS4} isSelected={false} onSelect={() => undefined} />);
    expect(screen.getAllByText(/S4/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Intimate/).length).toBeGreaterThan(0);
  });

  it("shows a needs review badge for tentative claims", () => {
    render(<ClaimCard claim={mockClaimS4} isSelected={false} onSelect={() => undefined} />);
    expect(screen.getByText("Needs review")).toBeInTheDocument();
  });

  it("shows an archived badge instead of a lifecycle icon", () => {
    render(<ClaimCard claim={mockClaimArchived} isSelected={false} onSelect={() => undefined} />);
    expect(screen.getByText("Archived")).toBeInTheDocument();
    expect(screen.queryByText("Needs review")).not.toBeInTheDocument();
  });

  it("shows a possible duplicate badge when flagged as conflicting", () => {
    render(<ClaimCard claim={mockClaimS4} isSelected={false} onSelect={() => undefined} hasConflict />);
    expect(screen.getByText("Possible duplicate")).toBeInTheDocument();
  });

  it("renders locked indicator when claim is locked", () => {
    render(<ClaimCard claim={mockClaimLocked} isSelected={false} onSelect={() => undefined} />);
    expect(screen.getByLabelText("locked-claim")).toBeInTheDocument();
  });

  it("adds review due class when claim needs review", () => {
    const { container } = render(<ClaimCard claim={mockClaimReviewDue} isSelected={false} onSelect={() => undefined} />);
    expect(container.firstChild).toHaveClass("border-yellow-500");
  });

  it("shows confidence as rounded percentage", () => {
    render(<ClaimCard claim={mockClaimLowConfidence} isSelected={false} onSelect={() => undefined} />);
    expect(screen.getByText("31%")).toBeInTheDocument();
  });

  it("applies selected glow class", () => {
    const { container } = render(<ClaimCard claim={mockClaimS4} isSelected onSelect={() => undefined} />);
    expect(container.firstChild).toHaveClass("neon-glow-blue");
  });

  it("triggers onSelect callback on click", async () => {
    const onSelect = vi.fn();
    render(<ClaimCard claim={mockClaimS4} isSelected={false} onSelect={onSelect} />);

    await userEvent.click(screen.getByRole("button"));
    expect(onSelect).toHaveBeenCalledWith(mockClaimS4);
  });
});
