import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CircuitBreakerSettings from "@/components/settings/CircuitBreakerSettings";

describe("CircuitBreakerSettings", () => {
  it("renders empty inputs for null override values", () => {
    render(
      <CircuitBreakerSettings
        maxActions={null}
        windowSeconds={null}
        cooldownSeconds={null}
        onSave={vi.fn().mockResolvedValue(undefined)}
      />,
    );
    expect(screen.getByLabelText("cb-max-actions")).toHaveValue(null);
    expect(screen.getByLabelText("cb-window-seconds")).toHaveValue(null);
    expect(screen.getByLabelText("cb-cooldown-seconds")).toHaveValue(null);
  });

  it("calls onSave with numeric values", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <CircuitBreakerSettings
        maxActions={null}
        windowSeconds={null}
        cooldownSeconds={null}
        onSave={onSave}
      />,
    );

    await userEvent.type(screen.getByLabelText("cb-max-actions"), "9");
    await userEvent.type(screen.getByLabelText("cb-window-seconds"), "60");
    await userEvent.type(screen.getByLabelText("cb-cooldown-seconds"), "120");
    await userEvent.click(screen.getByRole("button", { name: "Speichern" }));

    expect(onSave).toHaveBeenCalledWith(9, 60, 120);
  });

  it("shows error when values are invalid", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <CircuitBreakerSettings
        maxActions={null}
        windowSeconds={null}
        cooldownSeconds={null}
        onSave={onSave}
      />,
    );

    await userEvent.type(screen.getByLabelText("cb-window-seconds"), "2");
    await userEvent.click(screen.getByRole("button", { name: "Speichern" }));

    expect(screen.getByText(/Ungueltige Werte/i)).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });
});
