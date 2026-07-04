import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import ClaimDetail from "@/components/memory/ClaimDetail";
import { mockClaimS4, mockClaimTentative, mockClaimVersions } from "@/test/fixtures";

function buildHandlers() {
  return {
    onConfirm: vi.fn(async () => undefined),
    onRetract: vi.fn(async () => undefined),
    onArchive: vi.fn(async () => undefined),
    onLock: vi.fn(async () => undefined),
    onUnlock: vi.fn(async () => undefined),
    onSensitivityChange: vi.fn(async () => undefined),
  };
}

function renderWithRouter(ui: React.ReactElement): ReturnType<typeof render> {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe("ClaimDetail", () => {
  it("renders a plain-language summary sentence", () => {
    const handlers = buildHandlers();
    renderWithRouter(<ClaimDetail claim={mockClaimTentative} versions={mockClaimVersions} {...handlers} />);

    expect(screen.getByText("Preference: dark mode")).toBeInTheDocument();
  });

  it("renders a human-readable status sentence", () => {
    const handlers = buildHandlers();
    renderWithRouter(<ClaimDetail claim={mockClaimTentative} versions={mockClaimVersions} {...handlers} />);

    expect(screen.getByText(/Needs review - kept temporarily - cloud allowed if encrypted/)).toBeInTheDocument();
  });

  it("renders grouped technical detail sections", () => {
    const handlers = buildHandlers();
    renderWithRouter(<ClaimDetail claim={mockClaimTentative} versions={mockClaimVersions} {...handlers} />);

    expect(screen.getByText("Technical details")).toBeInTheDocument();
    expect(screen.getByText("Core")).toBeInTheDocument();
    expect(screen.getByText("Classification")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Timestamps")).toBeInTheDocument();
  });

  it("does not render user_id field", () => {
    const handlers = buildHandlers();
    renderWithRouter(<ClaimDetail claim={mockClaimTentative} versions={mockClaimVersions} {...handlers} />);

    expect(screen.queryByText("user_id")).not.toBeInTheDocument();
  });

  it("does not render ingested_at field", () => {
    const handlers = buildHandlers();
    renderWithRouter(<ClaimDetail claim={mockClaimTentative} versions={mockClaimVersions} {...handlers} />);

    expect(screen.queryByText("ingested_at")).not.toBeInTheDocument();
  });

  it("renders the version history", () => {
    const handlers = buildHandlers();
    renderWithRouter(<ClaimDetail claim={mockClaimTentative} versions={mockClaimVersions} {...handlers} />);

    expect(screen.getByText("Version history")).toBeInTheDocument();
    expect(screen.getByText(/Version #3/)).toBeInTheDocument();
  });

  it("renders a conflict warning with resolve hint when part of a conflict group", () => {
    const handlers = buildHandlers();
    renderWithRouter(
      <ClaimDetail
        claim={mockClaimTentative}
        versions={mockClaimVersions}
        conflictGroupId="cg-7"
        conflictRelatedCount={2}
        {...handlers}
      />,
    );

    expect(screen.getByText("2 memories look like they conflict or duplicate each other.")).toBeInTheDocument();
    expect(screen.getByText(/To resolve:/)).toBeInTheDocument();
  });

  it("hides the summary sentence behind S4Guard for intimate claims", () => {
    const handlers = buildHandlers();
    renderWithRouter(<ClaimDetail claim={mockClaimS4} versions={mockClaimVersions} {...handlers} />);

    expect(screen.queryByText(/Relationship: private/)).not.toBeInTheDocument();
    expect(screen.getByText(/hidden by default/)).toBeInTheDocument();
  });

  it("reveals the summary sentence after confirming the S4 guard", async () => {
    const handlers = buildHandlers();
    renderWithRouter(<ClaimDetail claim={mockClaimS4} versions={mockClaimVersions} {...handlers} />);

    await userEvent.click(screen.getByRole("button", { name: "Show content" }));
    expect(screen.getByText("Relationship: private")).toBeInTheDocument();
  });

  it("forwards confirm action from embedded ClaimActions", async () => {
    const handlers = buildHandlers();
    renderWithRouter(<ClaimDetail claim={mockClaimTentative} versions={mockClaimVersions} {...handlers} />);

    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(handlers.onConfirm).toHaveBeenCalledWith(mockClaimTentative.claim_id);
  });

  it("links to related audit entries when the claim has a source_ref", () => {
    const handlers = buildHandlers();
    renderWithRouter(<ClaimDetail claim={mockClaimTentative} versions={mockClaimVersions} {...handlers} />);

    const link = screen.getByRole("link", { name: "View related audit entries" });
    expect(link).toHaveAttribute(
      "href",
      `/audit?source_ref=${encodeURIComponent(mockClaimTentative.source_ref ?? "")}`,
    );
  });

  it("does not render an audit link when the claim has no source_ref", () => {
    const handlers = buildHandlers();
    renderWithRouter(
      <ClaimDetail claim={{ ...mockClaimTentative, source_ref: null }} versions={mockClaimVersions} {...handlers} />,
    );

    expect(screen.queryByRole("link", { name: "View related audit entries" })).not.toBeInTheDocument();
  });
});
