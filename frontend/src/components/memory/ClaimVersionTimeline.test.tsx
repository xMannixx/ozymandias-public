import { render, screen } from "@testing-library/react";
import ClaimVersionTimeline from "@/components/memory/ClaimVersionTimeline";
import { mockClaimVersions } from "@/test/fixtures";

describe("ClaimVersionTimeline", () => {
  it("renders fallback for empty list", () => {
    render(<ClaimVersionTimeline versions={[]} />);
    expect(screen.getByText("Keine Versionen vorhanden.")).toBeInTheDocument();
  });

  it("renders versions sorted by descending number", () => {
    render(<ClaimVersionTimeline versions={mockClaimVersions} />);
    const versions = screen.getAllByText(/Version #/);
    expect(versions[0]).toHaveTextContent("Version #3");
    expect(versions[1]).toHaveTextContent("Version #2");
    expect(versions[2]).toHaveTextContent("Version #1");
  });

  it("shows shortened hash in monospace", () => {
    render(<ClaimVersionTimeline versions={mockClaimVersions} />);
    expect(screen.getByText("hash-3-abcde")).toBeInTheDocument();
  });

  it("shows change reason and changed_by fields", () => {
    render(<ClaimVersionTimeline versions={mockClaimVersions} />);
    expect(screen.getByText("Archived due to stale relevance.")).toBeInTheDocument();
    expect(screen.getAllByText(/user ·/).length).toBeGreaterThan(0);
  });

  it("renders key values from content snapshot object", () => {
    render(<ClaimVersionTimeline versions={mockClaimVersions} />);
    expect(screen.getByText(/lifecycle:/)).toBeInTheDocument();
    expect(screen.getAllByText(/verification_state:/).length).toBeGreaterThan(0);
  });
});
