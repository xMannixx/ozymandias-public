import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ModeSwitch from "@/components/dashboard/ModeSwitch";
import { ModeProvider } from "@/store/mode";

function renderWithProvider(): void {
  render(
    <ModeProvider>
      <ModeSwitch />
    </ModeProvider>,
  );
}

describe("ModeSwitch", () => {
  it("guardian mode shows blue glow", () => {
    renderWithProvider();
    expect(screen.getByText("Guardian")).toHaveClass("neon-glow-blue");
  });

  it("toggle opens confirmation dialog", async () => {
    renderWithProvider();
    await userEvent.click(screen.getByRole("button", { name: "Zu Autopilot wechseln" }));
    expect(screen.getByRole("dialog", { name: "mode-confirm-dialog" })).toBeInTheDocument();
  });

  it("confirm switches mode", async () => {
    renderWithProvider();
    await userEvent.click(screen.getByRole("button", { name: "Zu Autopilot wechseln" }));
    await userEvent.click(screen.getByRole("button", { name: "Bestaetigen" }));
    expect(screen.getByText("Autopilot")).toBeInTheDocument();
  });
});
