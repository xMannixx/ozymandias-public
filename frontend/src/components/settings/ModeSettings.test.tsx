import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ModeSettings from "@/components/settings/ModeSettings";

const useModeMock = vi.fn();

vi.mock("@/store/mode", () => ({
  useMode: () => useModeMock(),
}));

describe("ModeSettings", () => {
  beforeEach(() => {
    useModeMock.mockReset();
    useModeMock.mockReturnValue({
      mode: "guardian",
      runtimeMode: "guardian",
      killSwitch: false,
      setMode: vi.fn(),
      toggleKillSwitch: vi.fn(),
    });
  });

  it("renders guardian mode badge", () => {
    render(<ModeSettings />);
    expect(screen.getByText("Guardian")).toHaveClass("neon-glow-blue");
  });

  it("opens confirmation dialog", async () => {
    render(<ModeSettings />);
    await userEvent.click(screen.getByRole("button", { name: "Zu Autopilot wechseln" }));
    expect(screen.getByRole("dialog", { name: "mode-settings-confirm" })).toBeInTheDocument();
  });

  it("confirm calls setMode with target mode", async () => {
    const setMode = vi.fn();
    useModeMock.mockReturnValue({
      mode: "guardian",
      runtimeMode: "guardian",
      killSwitch: false,
      setMode,
      toggleKillSwitch: vi.fn(),
    });
    render(<ModeSettings />);

    await userEvent.click(screen.getByRole("button", { name: "Zu Autopilot wechseln" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(setMode).toHaveBeenCalledWith("autopilot");
  });

  it("shows kill-switch hint when active", () => {
    useModeMock.mockReturnValue({
      mode: "kill-switch",
      runtimeMode: "autopilot",
      killSwitch: true,
      setMode: vi.fn(),
      toggleKillSwitch: vi.fn(),
    });
    render(<ModeSettings />);
    expect(screen.getByText(/Kill switch is active/i)).toBeInTheDocument();
  });
});
