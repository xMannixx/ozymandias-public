import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ModeProvider, useMode } from "@/store/mode";
import { mockSettings, mockSettingsAutopilot, mockSettingsKillSwitch } from "@/test/fixtures";

const getSettingsMock = vi.fn();
const updateSettingsMock = vi.fn();
const toggleKillSwitchMock = vi.fn();

vi.mock("@/api/settings", () => ({
  getSettings: (...args: unknown[]) => getSettingsMock(...args),
  updateSettings: (...args: unknown[]) => updateSettingsMock(...args),
  toggleKillSwitch: (...args: unknown[]) => toggleKillSwitchMock(...args),
}));

function Probe(): JSX.Element {
  const { mode, runtimeMode, killSwitch, setMode, toggleKillSwitch } = useMode();
  return (
    <div>
      <p aria-label="mode">{mode}</p>
      <p aria-label="runtime-mode">{runtimeMode}</p>
      <p aria-label="kill-switch">{killSwitch ? "yes" : "no"}</p>
      <button type="button" onClick={() => setMode("autopilot")}>
        set-autopilot
      </button>
      <button type="button" onClick={() => setMode("guardian")}>
        set-guardian
      </button>
      <button type="button" onClick={() => void toggleKillSwitch(true)}>
        enable-kill
      </button>
    </div>
  );
}

describe("store/mode", () => {
  beforeEach(() => {
    getSettingsMock.mockReset();
    updateSettingsMock.mockReset();
    toggleKillSwitchMock.mockReset();
    getSettingsMock.mockResolvedValue(mockSettings);
    updateSettingsMock.mockResolvedValue(mockSettings);
    toggleKillSwitchMock.mockResolvedValue(mockSettingsKillSwitch);
  });

  it("loads mode from backend settings", async () => {
    getSettingsMock.mockResolvedValueOnce(mockSettingsAutopilot);
    render(
      <ModeProvider>
        <Probe />
      </ModeProvider>,
    );

    await waitFor(() => {
      expect(screen.getByLabelText("runtime-mode")).toHaveTextContent("autopilot");
    });
    expect(getSettingsMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to guardian defaults when /settings fails", async () => {
    getSettingsMock.mockRejectedValueOnce(new Error("offline"));
    render(
      <ModeProvider>
        <Probe />
      </ModeProvider>,
    );

    await waitFor(() => {
      expect(screen.getByLabelText("mode")).toHaveTextContent("guardian");
    });
    expect(screen.getByLabelText("kill-switch")).toHaveTextContent("no");
  });

  it("setMode syncs mode to backend", async () => {
    updateSettingsMock.mockResolvedValueOnce(mockSettingsAutopilot);
    render(
      <ModeProvider>
        <Probe />
      </ModeProvider>,
    );
    await waitFor(() => {
      expect(screen.getByLabelText("mode")).toHaveTextContent("guardian");
    });

    await userEvent.click(screen.getByRole("button", { name: "set-autopilot" }));

    await waitFor(() => {
      expect(updateSettingsMock).toHaveBeenCalledWith({ mode: "autopilot" });
    });
    expect(screen.getByLabelText("runtime-mode")).toHaveTextContent("autopilot");
  });

  it("toggleKillSwitch updates mode to kill-switch", async () => {
    render(
      <ModeProvider>
        <Probe />
      </ModeProvider>,
    );
    await waitFor(() => {
      expect(screen.getByLabelText("mode")).toHaveTextContent("guardian");
    });

    await userEvent.click(screen.getByRole("button", { name: "enable-kill" }));

    await waitFor(() => {
      expect(toggleKillSwitchMock).toHaveBeenCalledWith(true);
    });
    expect(screen.getByLabelText("mode")).toHaveTextContent("kill-switch");
    expect(screen.getByLabelText("kill-switch")).toHaveTextContent("yes");
  });
});
