import type { ComponentProps } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProjectList from "@/components/projects/ProjectList";
import { mockProject } from "@/test/projects-fixtures";

function renderProjectList(overrides: Partial<ComponentProps<typeof ProjectList>> = {}): void {
  const props: ComponentProps<typeof ProjectList> = {
    projects: [mockProject],
    loading: false,
    error: null,
    statusFilter: null,
    toast: null,
    setStatusFilter: vi.fn(),
    createProject: vi.fn(async () => undefined),
    deleteProject: vi.fn(async () => undefined),
    openProject: vi.fn(),
    clearToast: vi.fn(),
    refetch: vi.fn(async () => undefined),
    ...overrides,
  };
  render(<ProjectList {...props} />);
}

describe("ProjectList", () => {
  it("rendert projekt-grid", () => {
    renderProjectList();
    expect(screen.getByTestId("projects-grid")).toBeInTheDocument();
    expect(screen.getByText("Projekt Alpha")).toBeInTheDocument();
  });

  it("zeigt platzhalter bei leerer liste", () => {
    renderProjectList({ projects: [] });
    expect(screen.getByText("No projects yet. Create your first project.")).toBeInTheDocument();
  });

  it("status-filter ruft setStatusFilter auf", async () => {
    const user = userEvent.setup();
    const setStatusFilter = vi.fn();
    renderProjectList({ setStatusFilter });

    await user.selectOptions(screen.getByLabelText("projects-status-filter"), "active");

    expect(setStatusFilter).toHaveBeenCalledWith("active");
  });

  it("neues projekt button oeffnet dialog", async () => {
    const user = userEvent.setup();
    renderProjectList();

    await user.click(screen.getByText("New project"));

    expect(screen.getByRole("heading", { name: "New project" })).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
  });
});
