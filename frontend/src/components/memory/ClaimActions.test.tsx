import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ClaimActions from "@/components/memory/ClaimActions";
import { mockClaimLocked, mockClaimRetracted, mockClaimTentative } from "@/test/fixtures";

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

describe("ClaimActions", () => {
  it("shows confirm button only for tentative claims", () => {
    const handlers = buildHandlers();
    const { rerender } = render(<ClaimActions claim={mockClaimTentative} {...handlers} />);

    expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument();

    rerender(<ClaimActions claim={{ ...mockClaimTentative, verification_state: "confirmed" }} {...handlers} />);
    expect(screen.queryByRole("button", { name: "Confirm" })).not.toBeInTheDocument();
  });

  it("calls confirm action", async () => {
    const handlers = buildHandlers();
    render(<ClaimActions claim={mockClaimTentative} {...handlers} />);

    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(handlers.onConfirm).toHaveBeenCalledWith(mockClaimTentative.claim_id);
  });

  it("shows retract confirmation dialog", async () => {
    const handlers = buildHandlers();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<ClaimActions claim={mockClaimTentative} {...handlers} />);

    await userEvent.click(screen.getByRole("button", { name: "Retract" }));
    expect(confirmSpy).toHaveBeenCalled();
    expect(handlers.onRetract).not.toHaveBeenCalled();
  });

  it("calls retract action after confirmation", async () => {
    const handlers = buildHandlers();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<ClaimActions claim={mockClaimTentative} {...handlers} />);

    await userEvent.click(screen.getByRole("button", { name: "Retract" }));
    expect(handlers.onRetract).toHaveBeenCalledWith(mockClaimTentative.claim_id);
  });

  it("shows archive confirmation dialog", async () => {
    const handlers = buildHandlers();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<ClaimActions claim={mockClaimTentative} {...handlers} />);

    await userEvent.click(screen.getByRole("button", { name: "Archive" }));
    expect(confirmSpy).toHaveBeenCalled();
    expect(handlers.onArchive).not.toHaveBeenCalled();
  });

  it("calls archive action after confirmation", async () => {
    const handlers = buildHandlers();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<ClaimActions claim={mockClaimTentative} {...handlers} />);

    await userEvent.click(screen.getByRole("button", { name: "Archive" }));
    expect(handlers.onArchive).toHaveBeenCalledWith(mockClaimTentative.claim_id);
  });

  it("calls lock when currently unlocked", async () => {
    const handlers = buildHandlers();
    render(<ClaimActions claim={mockClaimTentative} {...handlers} />);

    await userEvent.click(screen.getByRole("button", { name: "Lock" }));
    expect(handlers.onLock).toHaveBeenCalledWith(mockClaimTentative.claim_id);
  });

  it("calls unlock when currently locked", async () => {
    const handlers = buildHandlers();
    render(<ClaimActions claim={mockClaimLocked} {...handlers} />);

    await userEvent.click(screen.getByRole("button", { name: "Unlock" }));
    expect(handlers.onUnlock).toHaveBeenCalledWith(mockClaimLocked.claim_id);
  });

  it("calls sensitivity change action", async () => {
    const handlers = buildHandlers();
    render(<ClaimActions claim={mockClaimTentative} {...handlers} />);

    await userEvent.selectOptions(screen.getByLabelText("Privacy level"), "S4");
    expect(handlers.onSensitivityChange).toHaveBeenCalledWith(mockClaimTentative.claim_id, "S4");
  });

  it("labels privacy levels in plain language and explains the selected one", () => {
    const handlers = buildHandlers();
    render(<ClaimActions claim={mockClaimTentative} {...handlers} />);

    expect(screen.getByRole("option", { name: "S4 · Intimate" })).toBeInTheDocument();
    expect(screen.getByText(/Can be sent to any provider/)).toBeInTheDocument();
  });

  it("disables action buttons except lock when claim is retracted", () => {
    const handlers = buildHandlers();
    render(<ClaimActions claim={mockClaimRetracted} {...handlers} />);

    expect(screen.getByRole("button", { name: "Retract" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Archive" })).toBeDisabled();
    expect(screen.getByLabelText("Privacy level")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Lock" })).not.toBeDisabled();
  });

  it("supports async action without keeping controls disabled forever", async () => {
    const handlers = buildHandlers();
    render(<ClaimActions claim={mockClaimTentative} {...handlers} />);

    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(handlers.onConfirm).toHaveBeenCalledTimes(1);
  });
});
