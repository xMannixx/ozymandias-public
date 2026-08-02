import { render, screen } from "@testing-library/react";
import ClaimVersionTimeline from "@/components/memory/ClaimVersionTimeline";
import { mockClaimVersions } from "@/test/fixtures";

describe("ClaimVersionTimeline", () => {
  it("renders fallback for empty list", () => {
    render(<ClaimVersionTimeline versions={[]} />);
    expect(screen.getByText("No changes recorded yet.")).toBeInTheDocument();
  });

  it("renders versions sorted by descending number", () => {
    render(<ClaimVersionTimeline versions={mockClaimVersions} />);
    const versions = screen.getAllByText(/^Version \d/);
    expect(versions[0]).toHaveTextContent("Version 3");
    expect(versions[1]).toHaveTextContent("Version 2");
    expect(versions[2]).toHaveTextContent("Version 1");
  });

  it("shows shortened hash in monospace", () => {
    render(<ClaimVersionTimeline versions={mockClaimVersions} />);
    expect(screen.getByText("hash-3-abcde")).toBeInTheDocument();
  });

  it("names who made the change in plain language", () => {
    render(<ClaimVersionTimeline versions={mockClaimVersions} />);
    expect(screen.getByText("Archived due to stale relevance.")).toBeInTheDocument();
    expect(screen.getAllByText(/· You$/).length).toBeGreaterThan(0);
    expect(screen.getByText(/· Ozymandias$/)).toBeInTheDocument();
  });

  it("labels snapshot fields in plain language instead of raw column names", () => {
    render(<ClaimVersionTimeline versions={mockClaimVersions} />);
    expect(screen.getByText("Kept:")).toBeInTheDocument();
    expect(screen.getAllByText("Status:").length).toBeGreaterThan(0);
    expect(screen.queryByText(/verification_state/)).not.toBeInTheDocument();
  });

  it("renders snapshot values with human wording", () => {
    render(<ClaimVersionTimeline versions={mockClaimVersions} />);
    expect(screen.getByText("Archived")).toBeInTheDocument();
    expect(screen.getAllByText("Confirmed").length).toBeGreaterThan(0);
    expect(screen.getByText("92%")).toBeInTheDocument();
  });
});
