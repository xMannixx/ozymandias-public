import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MilestonesTab from "@/components/projects/tabs/MilestonesTab";
import { mockProjectDetail } from "@/test/projects-fixtures";

describe("MilestonesTab", () => {
  it("rendert timeline", () => {
    render(
      <MilestonesTab
        project={mockProjectDetail}
        loading={false}
        onCreateMilestone={vi.fn(async () => undefined)}
        onUpdateMilestone={vi.fn(async () => undefined)}
        onDeleteMilestone={vi.fn(async () => undefined)}
      />,
    );
    expect(screen.getByText("M1")).toBeInTheDocument();
  });

  it("checkbox setzt completed true", async () => {
    const user = userEvent.setup();
    const onUpdateMilestone = vi.fn(async () => undefined);
    render(
      <MilestonesTab
        project={mockProjectDetail}
        loading={false}
        onCreateMilestone={vi.fn(async () => undefined)}
        onUpdateMilestone={onUpdateMilestone}
        onDeleteMilestone={vi.fn(async () => undefined)}
      />,
    );

    await user.click(screen.getByLabelText("milestone-completed-m1"));
    expect(onUpdateMilestone).toHaveBeenCalledWith("m1", { completed: true });
  });

  it("erledigte meilensteine sind ausgegraut", () => {
    const completedProject = {
      ...mockProjectDetail,
      milestones: [
        {
          ...mockProjectDetail.milestones[0],
          completed: true,
        },
      ],
    };
    render(
      <MilestonesTab
        project={completedProject}
        loading={false}
        onCreateMilestone={vi.fn(async () => undefined)}
        onUpdateMilestone={vi.fn(async () => undefined)}
        onDeleteMilestone={vi.fn(async () => undefined)}
      />,
    );
    expect(screen.getByText("M1")).toHaveClass("line-through");
  });
});
