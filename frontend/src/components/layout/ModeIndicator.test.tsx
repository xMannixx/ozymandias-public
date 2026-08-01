import { render, screen } from "@testing-library/react";
import ModeIndicator from "@/components/layout/ModeIndicator";
import { useMode } from "@/store/mode";

vi.mock("@/store/mode", () => ({
  useMode: vi.fn(),
}));

describe("ModeIndicator", () => {
  it("renders guardian label", () => {
    vi.mocked(useMode).mockReturnValue({
      mode: "guardian",
      runtimeMode: "guardian",
      setMode: vi.fn(),
      killSwitch: false,
      toggleKillSwitch: vi.fn(),
    });
    render(<ModeIndicator />);
    expect(screen.getByText("Guardian")).toBeInTheDocument();
  });

  it("renders autopilot label", () => {
    vi.mocked(useMode).mockReturnValue({
      mode: "autopilot",
      runtimeMode: "autopilot",
      setMode: vi.fn(),
      killSwitch: false,
      toggleKillSwitch: vi.fn(),
    });
    render(<ModeIndicator />);
    expect(screen.getByText("Autopilot")).toBeInTheDocument();
  });

  it("renders kill-switch label", () => {
    vi.mocked(useMode).mockReturnValue({
      mode: "kill-switch",
      runtimeMode: "guardian",
      setMode: vi.fn(),
      killSwitch: true,
      toggleKillSwitch: vi.fn(),
    });
    render(<ModeIndicator />);
    expect(screen.getByText("Kill-switch")).toBeInTheDocument();
  });
});
