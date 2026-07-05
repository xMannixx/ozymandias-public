import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import KillSwitch from "@/components/settings/KillSwitch";

const useModeMock = vi.fn();

vi.mock("@/store/mode", () => ({
  useMode: () => useModeMock(),
}));

describe("KillSwitch", () => {
  beforeEach(() => {
    useModeMock.mockReset();
    useModeMock.mockReturnValue({
      mode: "guardian",
      runtimeMode: "guardian",
      killSwitch: false,
      setMode: vi.fn(),
      toggleKillSwitch: vi.fn().mockResolvedValue(undefined),
    });
  });

  it("renders inactive status by default", () => {
    render(<KillSwitch />);
    expect(screen.getByText("INAKTIV")).toBeInTheDocument();
  });

  it("opens confirmation dialog on click", async () => {
    render(<KillSwitch />);
    await userEvent.click(screen.getByRole("button", { name: "Enable kill switch" }));
    expect(screen.getByRole("dialog", { name: "kill-switch-confirm" })).toBeInTheDocument();
  });

  it("confirm button stays disabled until magic text is entered", async () => {
    render(<KillSwitch />);
    await userEvent.click(screen.getByRole("button", { name: "Enable kill switch" }));

    const confirmButton = screen.getByRole("button", { name: "Enable" });
    expect(confirmButton).toBeDisabled();

    await userEvent.type(screen.getByLabelText("kill-switch-confirm-input"), "wrong");
    expect(confirmButton).toBeDisabled();
  });

  it("calls toggleKillSwitch(true) on confirmed activation", async () => {
    const toggleKillSwitch = vi.fn().mockResolvedValue(undefined);
    useModeMock.mockReturnValue({
      mode: "guardian",
      runtimeMode: "guardian",
      killSwitch: false,
      setMode: vi.fn(),
      toggleKillSwitch,
    });
    render(<KillSwitch />);

    await userEvent.click(screen.getByRole("button", { name: "Enable kill switch" }));
    await userEvent.type(screen.getByLabelText("kill-switch-confirm-input"), "KILL SWITCH");
    await userEvent.click(screen.getByRole("button", { name: "Enable" }));

    expect(toggleKillSwitch).toHaveBeenCalledWith(true);
  });

  it("calls toggleKillSwitch(false) when deactivating", async () => {
    const toggleKillSwitch = vi.fn().mockResolvedValue(undefined);
    useModeMock.mockReturnValue({
      mode: "kill-switch",
      runtimeMode: "guardian",
      killSwitch: true,
      setMode: vi.fn(),
      toggleKillSwitch,
    });
    render(<KillSwitch />);

    await userEvent.click(screen.getByRole("button", { name: "Disable kill switch" }));
    await userEvent.type(screen.getByLabelText("kill-switch-confirm-input"), "KILL SWITCH");
    await userEvent.click(screen.getByRole("button", { name: "Disable" }));

    expect(toggleKillSwitch).toHaveBeenCalledWith(false);
  });
});
