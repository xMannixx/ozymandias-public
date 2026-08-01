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

  it("shows counts next to the segments when provided", () => {
    render(
      <ClaimFilters
        filters={baseFilters}
        onChange={() => undefined}
        onReset={() => undefined}
        counts={{ all: 12, needs_review: 3, archived: 1 }}
      />,
    );

    expect(screen.getByRole("button", { name: /All\s*12/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Needs review\s*3/ })).toBeInTheDocument();
  });

  it("keeps advanced filters (sensitivity, type, lifecycle, verification, trust) behind a collapsible drawer", async () => {
    render(<ClaimFilters filters={baseFilters} onChange={() => undefined} onReset={() => undefined} />);
    await openAdvancedFilters();

    ["S0 · Public", "S1 · General", "S2 · Personal", "S3 · Confidential", "S4 · Intimate"].forEach((label) => {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    });
    expect(screen.getByLabelText("Category")).toBeInTheDocument();
    expect(screen.getByLabelText("How long it is kept")).toBeInTheDocument();
    expect(screen.getByLabelText("Status")).toBeInTheDocument();
    expect(screen.getByLabelText("Source trust")).toBeInTheDocument();
  });

  it("labels enum options in plain language instead of raw database values", async () => {
    render(<ClaimFilters filters={baseFilters} onChange={() => undefined} onReset={() => undefined} />);
    await openAdvancedFilters();

    const statusSelect = screen.getByLabelText("Status");
    expect(within(statusSelect).getByRole("option", { name: "Needs review" })).toBeInTheDocument();
    expect(within(statusSelect).queryByRole("option", { name: "tentative" })).not.toBeInTheDocument();

    const lifecycleSelect = screen.getByLabelText("How long it is kept");
    expect(within(lifecycleSelect).getByRole("option", { name: "Permanent" })).toBeInTheDocument();
    expect(within(lifecycleSelect).queryByRole("option", { name: "permanent" })).not.toBeInTheDocument();

    const trustSelect = screen.getByLabelText("Source trust");
    expect(within(trustSelect).getByRole("option", { name: "T3 · Verified by you" })).toBeInTheDocument();
  });

  it("does not offer the dead T4 trust option", async () => {
    render(<ClaimFilters filters={baseFilters} onChange={() => undefined} onReset={() => undefined} />);
    await openAdvancedFilters();

    const trustSelect = screen.getByLabelText("Source trust");
    expect(within(trustSelect).queryByRole("option", { name: /T4/ })).not.toBeInTheDocument();
  });

  it("toggles sensitivity values through onChange", async () => {
    const onChange = vi.fn();
    render(<ClaimFilters filters={baseFilters} onChange={onChange} onReset={() => undefined} />);
    await openAdvancedFilters();

    await userEvent.click(screen.getByLabelText("S3 · Confidential"));
    expect(onChange).toHaveBeenCalledWith({ ...baseFilters, sensitivities: ["S3"] });
  });

  it("sends memoryType=health when Health is selected", async () => {
    const onChange = vi.fn();
    render(<ClaimFilters filters={baseFilters} onChange={onChange} onReset={() => undefined} />);
    await openAdvancedFilters();

    await userEvent.selectOptions(screen.getByLabelText("Category"), "health");
    expect(onChange).toHaveBeenCalledWith({ ...baseFilters, memoryType: "health" });
  });

  it("shows all 10 memory type labels in the dropdown", async () => {
    render(<ClaimFilters filters={baseFilters} onChange={() => undefined} onReset={() => undefined} />);
    await openAdvancedFilters();

    const memoryTypeSelect = screen.getByLabelText("Category");
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
