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
  it("renders subject and value", () => {
    render(<ClaimCard claim={mockClaimS4} isSelected={false} onSelect={() => undefined} />);

    expect(screen.getByText(mockClaimS4.subject)).toBeInTheDocument();
    expect(screen.getByText(mockClaimS4.value)).toBeInTheDocument();
  });

  it("renders sensitivity badge", () => {
    render(<ClaimCard claim={mockClaimS4} isSelected={false} onSelect={() => undefined} />);
    expect(screen.getByText("S4")).toBeInTheDocument();
  });

  it("renders trust level badge", () => {
    render(<ClaimCard claim={mockClaimS4} isSelected={false} onSelect={() => undefined} />);
    expect(screen.getByText(mockClaimS4.trust_level)).toBeInTheDocument();
  });

  it("renders lifecycle icon", () => {
    render(<ClaimCard claim={mockClaimArchived} isSelected={false} onSelect={() => undefined} />);
    expect(screen.getByText("A")).toBeInTheDocument();
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
