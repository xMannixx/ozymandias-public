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
  clearToast,
  refetch,
}: ProjectListProps): JSX.Element {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-xl font-medium text-zinc-100">Workspaces</h1>
        <p className="text-sm text-zinc-500">
          A workspace holds its own instructions, files, tasks and chats. Ozy uses all of it when
          you work inside one.
        </p>
      </header>

      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <Button type="button" onClick={() => setDialogOpen(true)}>
            New workspace
          </Button>
          <Button type="button" variant="ghost" onClick={() => void refetch()}>
            Reload
          </Button>
        </div>
        <select
          aria-label="projects-status-filter"
          value={statusFilter ?? ""}
          onChange={(event) => setStatusFilter(event.target.value || null)}
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
        <p className="glass-card p-4 text-sm text-red-300" role="alert">
          Could not load workspaces. {error}
        </p>
      ) : projects.length === 0 ? (
        <div className="glass-card space-y-1 p-6">
          <p className="text-sm text-zinc-200">No workspaces yet.</p>
          <p className="text-sm text-zinc-500">
            Create one for a topic you keep coming back to, then add instructions and files.
          </p>
        </div>
      ) : (
        <div
          className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4"
          data-testid="projects-grid"
        >
          {projects.map((project) => (
            <ProjectCard
              key={project.project_id}
              project={project}
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
