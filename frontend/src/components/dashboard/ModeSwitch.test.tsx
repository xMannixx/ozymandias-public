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
    expect(screen.getByTestId("mode-status")).toHaveClass("neon-glow-blue");
  });

  it("toggle opens confirmation dialog", async () => {
    renderWithProvider();
    await userEvent.click(screen.getByRole("button", { name: "Autopilot" }));
    expect(screen.getByRole("dialog", { name: "mode-confirm-dialog" })).toBeInTheDocument();
  });

  it("confirm switches mode", async () => {
    renderWithProvider();
    await userEvent.click(screen.getByRole("button", { name: "Autopilot" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(screen.getByTestId("mode-status")).toHaveTextContent("Autopilot");
  });
});
