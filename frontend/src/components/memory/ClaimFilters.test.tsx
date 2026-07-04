import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ClaimFilters from "@/components/memory/ClaimFilters";
import type { ClaimsFilters } from "@/hooks/useClaims";

const baseFilters: ClaimsFilters = {
  sensitivities: [],
  memoryType: "",
  lifecycle: "",
  verificationState: "",
  trustLevel: "",
};

describe("ClaimFilters", () => {
  it("renders all sensitivity checkboxes S0-S4", () => {
    render(<ClaimFilters filters={baseFilters} onChange={() => undefined} onReset={() => undefined} />);

    ["S0", "S1", "S2", "S3", "S4"].forEach((label) => {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    });
  });

  it("toggles sensitivity values through onChange", async () => {
    const onChange = vi.fn();
    render(<ClaimFilters filters={baseFilters} onChange={onChange} onReset={() => undefined} />);

    await userEvent.click(screen.getByLabelText("S3"));
    expect(onChange).toHaveBeenCalledWith({ ...baseFilters, sensitivities: ["S3"] });
  });

  it("updates lifecycle dropdown and includes archived option", async () => {
    const onChange = vi.fn();
    render(<ClaimFilters filters={baseFilters} onChange={onChange} onReset={() => undefined} />);

    const select = screen.getByLabelText("Lifecycle");
    expect(screen.getByRole("option", { name: "archived" })).toBeInTheDocument();
    await userEvent.selectOptions(select, "archived");

    expect(onChange).toHaveBeenCalledWith({ ...baseFilters, lifecycle: "archived" });
  });

  it("updates verification dropdown", async () => {
    const onChange = vi.fn();
    render(<ClaimFilters filters={baseFilters} onChange={onChange} onReset={() => undefined} />);

    await userEvent.selectOptions(screen.getByLabelText("Verification"), "confirmed");
    expect(onChange).toHaveBeenCalledWith({ ...baseFilters, verificationState: "confirmed" });
  });

  it("updates trust dropdown", async () => {
    const onChange = vi.fn();
    render(<ClaimFilters filters={baseFilters} onChange={onChange} onReset={() => undefined} />);

    await userEvent.selectOptions(screen.getByLabelText("Trust"), "T4");
    expect(onChange).toHaveBeenCalledWith({ ...baseFilters, trustLevel: "T4" });
  });

  it("fires reset callback", async () => {
    const onReset = vi.fn();
    render(<ClaimFilters filters={baseFilters} onChange={() => undefined} onReset={onReset} />);

    await userEvent.click(screen.getByRole("button", { name: "Filter zuruecksetzen" }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("shows all 10 memory type labels in the dropdown", () => {
    render(<ClaimFilters filters={baseFilters} onChange={() => undefined} onReset={() => undefined} />);

    const memoryTypeSelect = screen.getByLabelText("Memory Type");
    [
      "All",
      "Profile",
      "Health",
      "Preference",
      "Relationship",
      "Event",
      "Location",
      "Work",
      "Finance",
      "Security",
      "Intimate",
    ].forEach((label) => {
      expect(within(memoryTypeSelect).getByRole("option", { name: label })).toBeInTheDocument();
    });
  });

  it("sendet memoryType=health wenn Gesundheit gewaehlt wird", async () => {
    const onChange = vi.fn();
    render(<ClaimFilters filters={baseFilters} onChange={onChange} onReset={() => undefined} />);

    await userEvent.selectOptions(screen.getByLabelText("Memory Type"), "health");
    expect(onChange).toHaveBeenCalledWith({ ...baseFilters, memoryType: "health" });
  });
});
