import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ClaimDetail from "@/components/memory/ClaimDetail";
import { mockClaimTentative, mockClaimVersions } from "@/test/fixtures";

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

describe("ClaimDetail", () => {
  it("renders grouped sections", () => {
    const handlers = buildHandlers();
    render(<ClaimDetail claim={mockClaimTentative} versions={mockClaimVersions} {...handlers} />);

    expect(screen.getByText("Kern")).toBeInTheDocument();
    expect(screen.getByText("Klassifikation")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Zeitstempel")).toBeInTheDocument();
  });

  it("renders selected claim values", () => {
    const handlers = buildHandlers();
    render(<ClaimDetail claim={mockClaimTentative} versions={mockClaimVersions} {...handlers} />);

    expect(screen.getByText(mockClaimTentative.subject)).toBeInTheDocument();
    expect(screen.getByText(mockClaimTentative.value)).toBeInTheDocument();
  });

  it("does not render user_id field", () => {
    const handlers = buildHandlers();
    render(<ClaimDetail claim={mockClaimTentative} versions={mockClaimVersions} {...handlers} />);

    expect(screen.queryByText("user_id")).not.toBeInTheDocument();
  });

  it("does not render ingested_at field", () => {
    const handlers = buildHandlers();
    render(<ClaimDetail claim={mockClaimTentative} versions={mockClaimVersions} {...handlers} />);

    expect(screen.queryByText("ingested_at")).not.toBeInTheDocument();
  });

  it("renders versions timeline", () => {
    const handlers = buildHandlers();
    render(<ClaimDetail claim={mockClaimTentative} versions={mockClaimVersions} {...handlers} />);

    expect(screen.getByText("Versionshistorie")).toBeInTheDocument();
    expect(screen.getByText(/Version #3/)).toBeInTheDocument();
  });

  it("renders conflict group warning when id exists", () => {
    const handlers = buildHandlers();
    render(
      <ClaimDetail claim={mockClaimTentative} versions={mockClaimVersions} conflictGroupId="cg-7" {...handlers} />,
    );

    expect(screen.getByText("Konfliktgruppe aktiv: cg-7")).toBeInTheDocument();
  });

  it("forwards confirm action from embedded ClaimActions", async () => {
    const handlers = buildHandlers();
    render(<ClaimDetail claim={mockClaimTentative} versions={mockClaimVersions} {...handlers} />);

    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(handlers.onConfirm).toHaveBeenCalledWith(mockClaimTentative.claim_id);
  });
});
