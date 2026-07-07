import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DecaySettings from "@/components/settings/DecaySettings";

describe("DecaySettings", () => {
  it("renders incoming values", () => {
    render(<DecaySettings intervalHours={24} confidenceThreshold={0.6} onSave={vi.fn()} />);
    expect(screen.getByLabelText("decay-interval-hours")).toHaveValue(24);
    expect(screen.getByLabelText("decay-confidence-threshold")).toHaveValue("0.60");
  });

  it("calls onSave with normalized values", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<DecaySettings intervalHours={24} confidenceThreshold={0.6} onSave={onSave} />);

    await userEvent.clear(screen.getByLabelText("decay-interval-hours"));
    await userEvent.type(screen.getByLabelText("decay-interval-hours"), "48");
    fireEvent.change(screen.getByLabelText("decay-confidence-threshold"), { target: { value: "0.75" } });
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave).toHaveBeenCalledWith(48, 0.75);
  });

  it("shows error for invalid interval", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<DecaySettings intervalHours={24} confidenceThreshold={0.6} onSave={onSave} />);

    await userEvent.clear(screen.getByLabelText("decay-interval-hours"));
    await userEvent.type(screen.getByLabelText("decay-interval-hours"), "0");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByText(/Interval must be between 1 and 720 hours/i)).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("updates threshold from slider input", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<DecaySettings intervalHours={24} confidenceThreshold={0.6} onSave={onSave} />);

    fireEvent.change(screen.getByLabelText("decay-confidence-threshold"), { target: { value: "0.45" } });
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave).toHaveBeenCalledWith(24, 0.45);
  });
});
