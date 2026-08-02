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
  it("shows workspace counts", () => {
    render(
      <ProjectsSummary
        projectsActive={3}
        tasksOpen={7}
        knowledgeFiles={4}
        nextDueTask="File the return (2026-05-31)"
      />,
    );

    expect(screen.getByText("3 active")).toBeInTheDocument();
    expect(screen.getByText("7 open tasks")).toBeInTheDocument();
    expect(screen.getByText("4 files Ozy can quote")).toBeInTheDocument();
    expect(screen.getByText("Next up: File the return (2026-05-31)")).toBeInTheDocument();
  });

  it("says when nothing is due", () => {
    render(
      <ProjectsSummary projectsActive={1} tasksOpen={0} knowledgeFiles={1} nextDueTask={null} />,
    );

    expect(screen.getByText("Nothing with a deadline")).toBeInTheDocument();
    expect(screen.getByText("1 file Ozy can quote")).toBeInTheDocument();
  });

  it("navigates to the workspace list", async () => {
    const user = userEvent.setup();
    render(
      <ProjectsSummary projectsActive={3} tasksOpen={7} knowledgeFiles={4} nextDueTask={null} />,
    );

    await user.click(screen.getByTestId("projects-summary-card"));
    expect(navigateMock).toHaveBeenCalledWith("/projects");
  });
});
