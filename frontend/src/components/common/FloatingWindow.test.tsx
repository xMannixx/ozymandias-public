import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import FloatingWindow from "@/components/common/FloatingWindow";

vi.mock("react-rnd", () => ({
  Rnd: ({ children, onMouseDown }: { children: ReactNode; onMouseDown?: () => void }) => (
    <div data-testid="rnd-wrapper" onMouseDown={onMouseDown}>
      {children}
    </div>
  ),
}));

describe("FloatingWindow", () => {
  const baseProps = {
    title: "Projekt",
    windowId: "w1",
    position: { x: 10, y: 20 },
    size: { width: 800, height: 600 },
    onClose: vi.fn(),
  };

  it("rendert titel und content", () => {
    render(
      <FloatingWindow {...baseProps}>
        <div>Inhalt</div>
      </FloatingWindow>,
    );

    expect(screen.getByText("Projekt")).toBeInTheDocument();
    expect(screen.getByText("Inhalt")).toBeInTheDocument();
  });

  it("close button ruft onClose", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <FloatingWindow {...baseProps} onClose={onClose}>
        <div>Inhalt</div>
      </FloatingWindow>,
    );

    await user.click(screen.getByText("x"));
    expect(onClose).toHaveBeenCalled();
  });

  it("minimize button ruft onMinimize", async () => {
    const user = userEvent.setup();
    const onMinimize = vi.fn();
    render(
      <FloatingWindow {...baseProps} onMinimize={onMinimize}>
        <div>Inhalt</div>
      </FloatingWindow>,
    );

    await user.click(screen.getByText("-"));
    expect(onMinimize).toHaveBeenCalled();
  });

  it("mouse down bringt fenster nach vorne", async () => {
    const user = userEvent.setup();
    const onBringToFront = vi.fn();
    render(
      <FloatingWindow {...baseProps} onBringToFront={onBringToFront}>
        <div>Inhalt</div>
      </FloatingWindow>,
    );

    await user.click(screen.getByTestId("rnd-wrapper"));
    expect(onBringToFront).toHaveBeenCalled();
  });

  it("double click titlebar toggelt maximize", async () => {
    const user = userEvent.setup();
    const onToggleMaximize = vi.fn();
    render(
      <FloatingWindow {...baseProps} onToggleMaximize={onToggleMaximize}>
        <div>Inhalt</div>
      </FloatingWindow>,
    );

    await user.dblClick(screen.getByText("Projekt"));
    expect(onToggleMaximize).toHaveBeenCalled();
  });
});
