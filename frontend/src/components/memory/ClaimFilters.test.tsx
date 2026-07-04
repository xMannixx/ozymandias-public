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

async function openAdvancedFilters(): Promise<void> {
  await userEvent.click(screen.getByText(/Advanced filters/));
}

describe("ClaimFilters", () => {
  it("shows All as the active segment for empty filters", () => {
    render(<ClaimFilters filters={baseFilters} onChange={() => undefined} onReset={() => undefined} />);
    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");
  });

  it("switching to Needs review sets verificationState to tentative", async () => {
    const onChange = vi.fn();
    render(<ClaimFilters filters={baseFilters} onChange={onChange} onReset={() => undefined} />);

    await userEvent.click(screen.getByRole("button", { name: "Needs review" }));
    expect(onChange).toHaveBeenCalledWith({ ...baseFilters, verificationState: "tentative", lifecycle: "" });
  });

  it("switching to Archived sets lifecycle to archived", async () => {
    const onChange = vi.fn();
    render(<ClaimFilters filters={baseFilters} onChange={onChange} onReset={() => undefined} />);

    await userEvent.click(screen.getByRole("button", { name: "Archived" }));
    expect(onChange).toHaveBeenCalledWith({ ...baseFilters, lifecycle: "archived", verificationState: "" });
  });

  it("marks Needs review as active when verificationState is tentative", () => {
    render(
      <ClaimFilters
        filters={{ ...baseFilters, verificationState: "tentative" }}
        onChange={() => undefined}
        onReset={() => undefined}
      />,
    );
    expect(screen.getByRole("button", { name: "Needs review" })).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps advanced filters (sensitivity, type, lifecycle, verification, trust) behind a collapsible drawer", async () => {
    render(<ClaimFilters filters={baseFilters} onChange={() => undefined} onReset={() => undefined} />);
    await openAdvancedFilters();

    ["S0", "S1", "S2", "S3", "S4"].forEach((label) => {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    });
    expect(screen.getByLabelText("Memory Type")).toBeInTheDocument();
    expect(screen.getByLabelText("Lifecycle")).toBeInTheDocument();
    expect(screen.getByLabelText("Verification")).toBeInTheDocument();
    expect(screen.getByLabelText("Trust")).toBeInTheDocument();
  });

  it("does not offer the dead T4 trust option", async () => {
    render(<ClaimFilters filters={baseFilters} onChange={() => undefined} onReset={() => undefined} />);
    await openAdvancedFilters();

    const trustSelect = screen.getByLabelText("Trust");
    expect(within(trustSelect).queryByRole("option", { name: "T4" })).not.toBeInTheDocument();
  });

  it("toggles sensitivity values through onChange", async () => {
    const onChange = vi.fn();
    render(<ClaimFilters filters={baseFilters} onChange={onChange} onReset={() => undefined} />);
    await openAdvancedFilters();

    await userEvent.click(screen.getByLabelText("S3"));
    expect(onChange).toHaveBeenCalledWith({ ...baseFilters, sensitivities: ["S3"] });
  });

  it("sends memoryType=health when Health is selected", async () => {
    const onChange = vi.fn();
    render(<ClaimFilters filters={baseFilters} onChange={onChange} onReset={() => undefined} />);
    await openAdvancedFilters();

    await userEvent.selectOptions(screen.getByLabelText("Memory Type"), "health");
    expect(onChange).toHaveBeenCalledWith({ ...baseFilters, memoryType: "health" });
  });

  it("shows all 10 memory type labels in the dropdown", async () => {
    render(<ClaimFilters filters={baseFilters} onChange={() => undefined} onReset={() => undefined} />);
    await openAdvancedFilters();

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

  it("fires reset callback", async () => {
    const onReset = vi.fn();
    render(<ClaimFilters filters={baseFilters} onChange={() => undefined} onReset={onReset} />);

    await userEvent.click(screen.getByRole("button", { name: "Reset filters" }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
