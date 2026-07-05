import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProjectsSummary from "@/components/dashboard/ProjectsSummary";

const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

describe("ProjectsSummary", () => {
  it("zeigt projektzahlen", () => {
    render(
      <ProjectsSummary
        projectsActive={3}
        tasksOpen={7}
        risksCritical={2}
        nextMilestone="M1"
      />,
    );

    expect(screen.getByText("3 active projects")).toBeInTheDocument();
    expect(screen.getByText("7 open tasks")).toBeInTheDocument();
    expect(screen.getByText("2 kritische Risiken")).toBeInTheDocument();
  });

  it("klick navigiert zu /projects", async () => {
    const user = userEvent.setup();
    render(
      <ProjectsSummary
        projectsActive={3}
        tasksOpen={7}
        risksCritical={2}
        nextMilestone="M1"
      />,
    );

    await user.click(screen.getByTestId("projects-summary-card"));
    expect(navigateMock).toHaveBeenCalledWith("/projects");
  });
});
