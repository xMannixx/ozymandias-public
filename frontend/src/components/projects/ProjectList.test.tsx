import type { ComponentProps } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
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
    clearToast: vi.fn(),
    refetch: vi.fn(async () => undefined),
    ...overrides,
  };
  render(
    <MemoryRouter>
      <ProjectList {...props} />
    </MemoryRouter>,
  );
}

describe("ProjectList", () => {
  it("renders the workspace grid", () => {
    renderProjectList();
    expect(screen.getByTestId("projects-grid")).toBeInTheDocument();
    expect(screen.getByText("Tax return 2026")).toBeInTheDocument();
  });

  it("explains the empty state", () => {
    renderProjectList({ projects: [] });
    expect(screen.getByText("No workspaces yet.")).toBeInTheDocument();
  });

  it("filters by status", async () => {
    const user = userEvent.setup();
    const setStatusFilter = vi.fn();
    renderProjectList({ setStatusFilter });

    await user.selectOptions(screen.getByLabelText("projects-status-filter"), "active");

    expect(setStatusFilter).toHaveBeenCalledWith("active");
  });

  it("opens the create dialog", async () => {
    const user = userEvent.setup();
    renderProjectList();

    await user.click(screen.getByRole("button", { name: "New workspace" }));

    expect(screen.getByRole("dialog", { name: "New workspace" })).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Instructions (optional)")).toBeInTheDocument();
  });
});
