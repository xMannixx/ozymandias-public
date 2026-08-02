import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BriefingSettings from "@/components/settings/BriefingSettings";

describe("BriefingSettings", () => {
  it("renders the stored schedule", () => {
    render(<BriefingSettings enabled hour={7} onSave={vi.fn()} />);

    expect(screen.getByLabelText("settings-briefing-enabled")).toBeChecked();
    expect(screen.getByLabelText("settings-briefing-hour")).toHaveValue("7");
  });

  it("saves the chosen hour", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<BriefingSettings enabled hour={7} onSave={onSave} />);

    await userEvent.selectOptions(screen.getByLabelText("settings-briefing-hour"), "6");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(onSave).toHaveBeenCalledWith(true, 6);
  });

  it("saves the briefing being turned off", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<BriefingSettings enabled hour={7} onSave={onSave} />);

    await userEvent.click(screen.getByLabelText("settings-briefing-enabled"));
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(onSave).toHaveBeenCalledWith(false, 7);
  });

  it("disables the hour while the briefing is off", () => {
    render(<BriefingSettings enabled={false} hour={7} onSave={vi.fn()} />);

    expect(screen.getByLabelText("settings-briefing-hour")).toBeDisabled();
  });
});
