import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AuditFilters from "@/components/audit/AuditFilters";
import { defaultAuditFilters } from "@/hooks/useAudit";

describe("AuditFilters", () => {
  it("event type dropdown updates filter", async () => {
    const onChange = vi.fn();
    render(
      <AuditFilters
        filters={defaultAuditFilters}
        onChange={onChange}
        onReset={vi.fn()}
        showS4={false}
        onShowS4Change={vi.fn()}
      />,
    );

    await userEvent.selectOptions(screen.getByLabelText("audit-event-type"), "memory_confirmed");
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("sensitivity dropdown updates filter", async () => {
    const onChange = vi.fn();
    render(
      <AuditFilters
        filters={defaultAuditFilters}
        onChange={onChange}
        onReset={vi.fn()}
        showS4={false}
        onShowS4Change={vi.fn()}
      />,
    );

    await userEvent.selectOptions(screen.getByLabelText("audit-sensitivity"), "S3");
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("date inputs set after and before filters", async () => {
    const onChange = vi.fn();
    render(
      <AuditFilters
        filters={defaultAuditFilters}
        onChange={onChange}
        onReset={vi.fn()}
        showS4={false}
        onShowS4Change={vi.fn()}
      />,
    );

    await userEvent.type(screen.getByLabelText("audit-after"), "2026-04-06");
    await userEvent.type(screen.getByLabelText("audit-before"), "2026-04-07");

    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("reset button calls reset handler", async () => {
    const onReset = vi.fn();
    render(
      <AuditFilters
        filters={defaultAuditFilters}
        onChange={vi.fn()}
        onReset={onReset}
        showS4={false}
        onShowS4Change={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Filter zuruecksetzen" }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("initial values are rendered", () => {
    render(
      <AuditFilters
        filters={defaultAuditFilters}
        onChange={vi.fn()}
        onReset={vi.fn()}
        showS4={false}
        onShowS4Change={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("audit-event-type")).toHaveValue("");
    expect(screen.getByLabelText("audit-sensitivity")).toHaveValue("");
    expect(screen.getByLabelText("audit-result")).toHaveValue("");
  });
});
