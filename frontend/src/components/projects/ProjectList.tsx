import { useState } from "react";
import type { CreateProjectRequest, ProjectResponse } from "@/api/types";
import Button from "@/components/common/Button";
import Spinner from "@/components/common/Spinner";
import Toast from "@/components/common/Toast";
import CreateProjectDialog from "@/components/projects/CreateProjectDialog";
import ProjectCard from "@/components/projects/ProjectCard";

type ProjectListProps = {
  projects: ProjectResponse[];
  loading: boolean;
  error: string | null;
  statusFilter: string | null;
  toast: { message: string; type: "success" | "error" | "info" } | null;
  setStatusFilter: (value: string | null) => void;
  createProject: (data: CreateProjectRequest) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  openProject: (projectId: string, projectName: string) => void;
  clearToast: () => void;
  refetch: () => Promise<void>;
};

function ProjectList({
  projects,
  loading,
  error,
  statusFilter,
  toast,
  setStatusFilter,
  createProject,
  deleteProject,
  openProject,
  clearToast,
  refetch,
}: ProjectListProps): JSX.Element {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <section className="space-y-4">
      <div className="glass-card flex flex-col gap-2 p-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <Button type="button" onClick={() => setDialogOpen(true)}>
            New project
          </Button>
          <Button type="button" variant="ghost" onClick={() => void refetch()}>
            Reload
          </Button>
        </div>
        <select
          aria-label="projects-status-filter"
          value={statusFilter ?? ""}
          onChange={(event) => setStatusFilter(event.target.value || null)}
          className="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100"
        >
          <option value="">All</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {toast ? (
        <div onAnimationEnd={clearToast}>
          <Toast message={toast.message} type={toast.type} timeoutMs={3200} />
        </div>
      ) : null}

      {loading && projects.length === 0 ? (
        <div className="glass-card flex justify-center p-6" role="status" aria-live="polite">
          <Spinner />
        </div>
      ) : error && projects.length === 0 ? (
        <p className="glass-card p-4 text-sm text-red-300" role="alert">Could not load projects. {error}</p>
      ) : projects.length === 0 ? (
        <div className="glass-card p-6 text-sm text-gray-300">
          No projects yet. Create your first project.
        </div>
      ) : (
        <div
          className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4"
          data-testid="projects-grid"
        >
          {projects.map((project) => (
            <ProjectCard
              key={project.project_id}
              project={project}
              onOpen={openProject}
              onDelete={(projectId) => {
                void deleteProject(projectId);
              }}
            />
          ))}
        </div>
      )}

      <CreateProjectDialog
        open={dialogOpen}
        creating={loading}
        onClose={() => setDialogOpen(false)}
        onCreate={createProject}
      />
    </section>
  );
}

export default ProjectList;
