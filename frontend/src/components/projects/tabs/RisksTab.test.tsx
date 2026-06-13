import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RisksTab from "@/components/projects/tabs/RisksTab";
import { mockProjectDetail } from "@/test/projects-fixtures";

describe("RisksTab", () => {
  it("rendert risiken sortiert nach severity", () => {
    const project = {
      ...mockProjectDetail,
      risks: [
        { ...mockProjectDetail.risks[0], risk_id: "r-low", name: "Low", severity: "low" as const },
        { ...mockProjectDetail.risks[0], risk_id: "r-critical", name: "Critical", severity: "critical" as const },
      ],
    };
    const { container } = render(
      <RisksTab
        project={project}
        loading={false}
        onCreateRisk={vi.fn(async () => undefined)}
        onUpdateRisk={vi.fn(async () => undefined)}
        onDeleteRisk={vi.fn(async () => undefined)}
      />,
    );

    const html = container.innerHTML;
    expect(html.indexOf("Critical")).toBeLessThan(html.indexOf("Low"));
  });

  it("status dropdown aendert status", async () => {
    const user = userEvent.setup();
    const onUpdateRisk = vi.fn(async () => undefined);
    render(
      <RisksTab
        project={mockProjectDetail}
        loading={false}
        onCreateRisk={vi.fn(async () => undefined)}
        onUpdateRisk={onUpdateRisk}
        onDeleteRisk={vi.fn(async () => undefined)}
      />,
    );

    await user.selectOptions(screen.getByDisplayValue("open"), "resolved");

    expect(onUpdateRisk).toHaveBeenCalledWith("r1", { status: "resolved" });
  });
});
