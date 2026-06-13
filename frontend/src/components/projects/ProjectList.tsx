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
            Neues Projekt
          </Button>
          <Button type="button" variant="ghost" onClick={() => void refetch()}>
            Neu laden
          </Button>
        </div>
        <select
          aria-label="projects-status-filter"
          value={statusFilter ?? ""}
          onChange={(event) => setStatusFilter(event.target.value || null)}
          className="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100"
        >
          <option value="">Alle</option>
          <option value="active">Aktiv</option>
          <option value="paused">Pausiert</option>
          <option value="completed">Fertig</option>
          <option value="cancelled">Abgebrochen</option>
        </select>
      </div>

      {toast ? (
        <div onAnimationEnd={clearToast}>
          <Toast message={toast.message} type={toast.type} timeoutMs={3200} />
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      {loading && projects.length === 0 ? (
        <div className="glass-card flex justify-center p-6">
          <Spinner />
        </div>
      ) : null}

      {projects.length === 0 && !loading ? (
        <div className="glass-card p-6 text-sm text-gray-300">
          Keine Projekte vorhanden. Erstelle dein erstes Projekt.
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
