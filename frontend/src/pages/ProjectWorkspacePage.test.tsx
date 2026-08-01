import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ProjectWorkspacePage from "@/pages/ProjectWorkspacePage";
import { mockProjectDetail } from "@/test/projects-fixtures";
import type { ProjectDetailResponse } from "@/api/types";

const useProjectDetailMock = vi.fn();

vi.mock("@/hooks/useProjectDetail", () => ({
  useProjectDetail: (...args: unknown[]) => useProjectDetailMock(...args),
}));

vi.mock("@/components/projects/WorkspaceChat", () => ({
  default: ({ projectName }: { projectName: string }) => (
    <div data-testid="workspace-chat">{projectName}</div>
  ),
}));

function detailResult(
  project: ProjectDetailResponse | null,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    selectedProject: project,
    loading: false,
    error: null,
    toast: null,
    refetch: vi.fn(async () => undefined),
    updateProject: vi.fn(async () => undefined),
    createTask: vi.fn(async () => undefined),
    updateTask: vi.fn(async () => undefined),
    deleteTask: vi.fn(async () => undefined),
    createNote: vi.fn(async () => undefined),
    deleteNote: vi.fn(async () => undefined),
    createLink: vi.fn(async () => undefined),
    deleteLink: vi.fn(async () => undefined),
    uploadFile: vi.fn(async () => undefined),
    deleteFile: vi.fn(async () => undefined),
    downloadFile: vi.fn(async () => undefined),
    clearToast: vi.fn(),
    ...overrides,
  };
}

function renderWorkspace(): void {
  render(
    <MemoryRouter initialEntries={["/projects/project-1"]}>
      <Routes>
        <Route path="/projects/:projectId" element={<ProjectWorkspacePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProjectWorkspacePage", () => {
  beforeEach(() => {
    useProjectDetailMock.mockReset();
    useProjectDetailMock.mockReturnValue(detailResult(mockProjectDetail));
  });

  it("loads the workspace from the route", () => {
    renderWorkspace();

    expect(useProjectDetailMock).toHaveBeenCalledWith("project-1");
    expect(screen.getByRole("heading", { name: /Tax return 2026/ })).toBeInTheDocument();
  });

  it("opens on the chat, since that is the point of a workspace", () => {
    renderWorkspace();

    expect(screen.getByTestId("workspace-chat")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Chat/ })).toHaveAttribute("aria-selected", "true");
  });

  it("summarizes what travels into the chat", () => {
    renderWorkspace();

    expect(
      screen.getByText(/your instructions, 1 readable file, 1 open task and 1 note/),
    ).toBeInTheDocument();
  });

  it("switches to the knowledge section", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await user.click(screen.getByRole("tab", { name: /Knowledge/ }));

    expect(screen.getByText("Files")).toBeInTheDocument();
    expect(screen.queryByTestId("workspace-chat")).not.toBeInTheDocument();
  });

  it("switches to the instructions section", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await user.click(screen.getByRole("tab", { name: /Instructions/ }));

    expect(screen.getByLabelText("Instructions for this workspace")).toBeInTheDocument();
  });

  it("marks a workspace that never leaves the machine", () => {
    useProjectDetailMock.mockReturnValue(
      detailResult({ ...mockProjectDetail, sensitivity: "S3" }),
    );
    renderWorkspace();

    expect(screen.getByText("Local models only")).toBeInTheDocument();
  });

  it("offers a way back when the workspace is gone", () => {
    useProjectDetailMock.mockReturnValue(
      detailResult(null, { error: "Project not found: project-1" }),
    );
    renderWorkspace();

    expect(screen.getByRole("heading", { name: "Workspace not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to all projects" })).toHaveAttribute(
      "href",
      "/projects",
    );
  });
});
