import { act, renderHook, waitFor } from "@testing-library/react";
import { useProjects } from "@/hooks/useProjects";
import { mockProject } from "@/test/projects-fixtures";

const listProjectsMock = vi.fn();
const createProjectMock = vi.fn();
const deleteProjectMock = vi.fn();

vi.mock("@/api/projects", () => ({
  listProjects: (...args: unknown[]) => listProjectsMock(...args),
  createProject: (...args: unknown[]) => createProjectMock(...args),
  deleteProject: (...args: unknown[]) => deleteProjectMock(...args),
}));

describe("useProjects", () => {
  beforeEach(() => {
    listProjectsMock.mockReset();
    createProjectMock.mockReset();
    deleteProjectMock.mockReset();

    listProjectsMock.mockResolvedValue([mockProject]);
    createProjectMock.mockResolvedValue({ ...mockProject, project_id: "project-2", name: "Neu" });
    deleteProjectMock.mockResolvedValue(undefined);
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("laedt Projekte beim Mount", async () => {
    const { result } = renderHook(() => useProjects());

    await waitFor(() => {
      expect(result.current.projects).toHaveLength(1);
    });
    expect(listProjectsMock).toHaveBeenCalledWith(undefined);
  });

  it("select filter triggert listProjects mit status", async () => {
    const { result } = renderHook(() => useProjects());

    await waitFor(() => {
      expect(result.current.projects).toHaveLength(1);
    });

    act(() => {
      result.current.setStatusFilter("active");
    });

    await waitFor(() => {
      expect(listProjectsMock).toHaveBeenCalledWith("active");
    });
  });

  it("createProject aktualisiert state", async () => {
    const { result } = renderHook(() => useProjects());

    await waitFor(() => {
      expect(result.current.projects).toHaveLength(1);
    });

    await act(async () => {
      await result.current.createProject({ name: "Neu" });
    });

    expect(createProjectMock).toHaveBeenCalled();
    expect(result.current.projects[0].name).toBe("Neu");
  });

  it("deleteProject entfernt projekt aus state", async () => {
    const { result } = renderHook(() => useProjects());

    await waitFor(() => {
      expect(result.current.projects).toHaveLength(1);
    });

    await act(async () => {
      await result.current.deleteProject(mockProject.project_id);
    });

    expect(deleteProjectMock).toHaveBeenCalledWith(mockProject.project_id);
    expect(result.current.projects).toHaveLength(0);
  });
});
