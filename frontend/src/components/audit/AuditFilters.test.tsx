import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AuditFilters from "@/components/audit/AuditFilters";
import { defaultAuditFilters } from "@/hooks/useAudit";

function renderFilters(overrides: Partial<React.ComponentProps<typeof AuditFilters>> = {}) {
  const props = {
    filters: defaultAuditFilters,
    onChange: vi.fn(),
    onReset: vi.fn(),
    showS4: false,
    onShowS4Change: vi.fn(),
    category: "all" as const,
    onCategoryChange: vi.fn(),
    ...overrides,
  };
  render(<AuditFilters {...props} />);
  return props;
}

async function openAdvancedFilters(): Promise<void> {
  await userEvent.click(screen.getByText(/Advanced filters/));
}

describe("AuditFilters", () => {
  it("renders category chips with All active by default", () => {
    renderFilters();
    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");
    ["Memory", "Actions", "Security", "System"].forEach((label) => {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    });
  });

  it("clicking a category chip calls onCategoryChange", async () => {
    const props = renderFilters();
    await userEvent.click(screen.getByRole("button", { name: "Security" }));
    expect(props.onCategoryChange).toHaveBeenCalledWith("security");
  });

  it("result dropdown updates filter", async () => {
    const props = renderFilters();
    await userEvent.selectOptions(screen.getByLabelText("audit-result"), "blocked");
    expect(props.onChange).toHaveBeenCalledTimes(1);
  });

  it("date inputs set after and before filters", async () => {
    const props = renderFilters();
    await userEvent.type(screen.getByLabelText("audit-after"), "2026-04-06");
    await userEvent.type(screen.getByLabelText("audit-before"), "2026-04-07");
    expect(props.onChange).toHaveBeenCalledTimes(2);
  });

  it("event type and sensitivity dropdowns are behind Advanced filters", async () => {
    renderFilters();
    await openAdvancedFilters();
    expect(screen.getByLabelText("audit-event-type")).toBeInTheDocument();
    expect(screen.getByLabelText("audit-sensitivity")).toBeInTheDocument();
  });

  it("event type dropdown updates filter", async () => {
    const props = renderFilters();
    await openAdvancedFilters();
    await userEvent.selectOptions(screen.getByLabelText("audit-event-type"), "memory_confirmed");
    expect(props.onChange).toHaveBeenCalledTimes(1);
  });

  it("sensitivity dropdown updates filter", async () => {
    const props = renderFilters();
    await openAdvancedFilters();
    await userEvent.selectOptions(screen.getByLabelText("audit-sensitivity"), "S3");
    expect(props.onChange).toHaveBeenCalledTimes(1);
  });

  it("reset button calls reset handler", async () => {
    const props = renderFilters();
    await userEvent.click(screen.getByRole("button", { name: "Reset filters" }));
    expect(props.onReset).toHaveBeenCalledTimes(1);
  });

  it("initial values are rendered", async () => {
    renderFilters();
    await openAdvancedFilters();
    expect(screen.getByLabelText("audit-event-type")).toHaveValue("");
    expect(screen.getByLabelText("audit-sensitivity")).toHaveValue("");
    expect(screen.getByLabelText("audit-result")).toHaveValue("");
  });
});
