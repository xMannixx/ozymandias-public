import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProjectWindow from "@/components/projects/ProjectWindow";
import { mockProjectDetail } from "@/test/projects-fixtures";

const useProjectDetailMock = vi.fn();

vi.mock("@/hooks/useProjectDetail", () => ({
  useProjectDetail: (...args: unknown[]) => useProjectDetailMock(...args),
}));

describe("ProjectWindow", () => {
  beforeEach(() => {
    useProjectDetailMock.mockReturnValue({
      selectedProject: mockProjectDetail,
      loading: false,
      error: null,
      toast: null,
      updateProject: vi.fn(async () => undefined),
      createMilestone: vi.fn(async () => undefined),
      updateMilestone: vi.fn(async () => undefined),
      deleteMilestone: vi.fn(async () => undefined),
      createTask: vi.fn(async () => undefined),
      updateTask: vi.fn(async () => undefined),
      deleteTask: vi.fn(async () => undefined),
      createRisk: vi.fn(async () => undefined),
      updateRisk: vi.fn(async () => undefined),
      deleteRisk: vi.fn(async () => undefined),
      createNote: vi.fn(async () => undefined),
      deleteNote: vi.fn(async () => undefined),
      createLink: vi.fn(async () => undefined),
      deleteLink: vi.fn(async () => undefined),
      uploadFile: vi.fn(async () => undefined),
      deleteFile: vi.fn(async () => undefined),
      downloadFile: vi.fn(async () => undefined),
      clearToast: vi.fn(),
    });
  });

  it("laedt detail ueber hook beim mount", () => {
    render(<ProjectWindow projectId="project-1" />);
    expect(useProjectDetailMock).toHaveBeenCalledWith("project-1");
  });

  it("zeigt tabs an", () => {
    render(<ProjectWindow projectId="project-1" />);
    expect(screen.getByText("Uebersicht")).toBeInTheDocument();
    expect(screen.getByText("Aufgaben")).toBeInTheDocument();
    expect(screen.getByText("Dateien")).toBeInTheDocument();
  });

  it("tab wechsel zeigt aufgaben", async () => {
    const user = userEvent.setup();
    render(<ProjectWindow projectId="project-1" />);

    await user.click(screen.getByText("Aufgaben"));

    expect(screen.getByText("Task offen")).toBeInTheDocument();
  });
});
