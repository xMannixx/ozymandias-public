import { render, screen } from "@testing-library/react";
import ModeIndicator from "@/components/layout/ModeIndicator";
import { useMode } from "@/store/mode";

vi.mock("@/store/mode", () => ({
  useMode: vi.fn(),
}));

describe("ModeIndicator", () => {
  it("shows guardian with blue glow", () => {
    vi.mocked(useMode).mockReturnValue({
      mode: "guardian",
      runtimeMode: "guardian",
      setMode: vi.fn(),
      killSwitch: false,
      toggleKillSwitch: vi.fn(),
    });
    render(<ModeIndicator />);
    expect(screen.getByText("Guardian")).toHaveClass("neon-glow-blue");
  });

  it("shows autopilot with orange glow", () => {
    vi.mocked(useMode).mockReturnValue({
      mode: "autopilot",
      runtimeMode: "autopilot",
      setMode: vi.fn(),
      killSwitch: false,
      toggleKillSwitch: vi.fn(),
    });
    render(<ModeIndicator />);
    expect(screen.getByText("Autopilot")).toHaveClass("neon-glow-orange");
  });
});
