import Button from "@/components/common/Button";
import type { ProjectPriority, ProjectResponse, ProjectStatus } from "@/api/types";

type ProjectCardProps = {
  project: ProjectResponse;
  onOpen: (projectId: string, name: string) => void;
  onDelete: (projectId: string) => void;
};

const statusLabel: Record<ProjectStatus, string> = {
  active: "Active",
  paused: "Paused",
  completed: "Completed",
  cancelled: "Cancelled",
};

const statusClass: Record<ProjectStatus, string> = {
  active: "bg-green-700/40 text-green-100",
  paused: "bg-yellow-700/40 text-yellow-100",
  completed: "bg-gray-700/60 text-gray-100",
  cancelled: "bg-red-700/40 text-red-100",
};

const priorityClass: Record<ProjectPriority, string> = {
  low: "bg-gray-700/60 text-gray-100",
  medium: "bg-blue-700/50 text-blue-100",
  high: "bg-orange-700/50 text-orange-100",
  critical: "bg-red-700/60 text-red-100",
};

function formatDateRange(startDate: string | null, targetDate: string | null): string {
  const start = startDate ? new Date(startDate).toLocaleDateString("en-GB") : "-";
  const target = targetDate ? new Date(targetDate).toLocaleDateString("en-GB") : "-";
  return `${start} - ${target}`;
}

function clampPercent(value: number): number {
  if (value < 0) {
    return 0;
  }
  if (value > 100) {
    return 100;
  }
  return value;
}

function ProjectCard({ project, onOpen, onDelete }: ProjectCardProps): JSX.Element {
  const progress =
    project.task_count > 0 ? clampPercent(Math.round((project.task_done_count / project.task_count) * 100)) : 0;

  return (
    <article
      className="glass-card cursor-pointer space-y-3 border-l-4 p-4 transition hover:border-blue-500/70 hover:shadow-[0_0_24px_rgba(88,166,255,0.15)]"
      style={{ borderLeftColor: project.color ?? "#58a6ff" }}
      onClick={() => onOpen(project.project_id, project.name)}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="line-clamp-2 text-base font-semibold text-blue-100">{project.name}</h3>
        <Button
          type="button"
          variant="danger"
          className="h-8 px-2 py-0 text-xs"
          aria-label={`delete-project-${project.project_id}`}
          onClick={(event) => {
            event.stopPropagation();
            onDelete(project.project_id);
          }}
        >
          Del
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={`rounded-full px-2 py-1 font-semibold ${statusClass[project.status]}`}>
          {statusLabel[project.status]}
        </span>
        <span className={`rounded-full px-2 py-1 font-semibold ${priorityClass[project.priority]}`}>
          {project.priority}
        </span>
      </div>

      <div className="space-y-1">
        <div className="h-2 rounded-full bg-gray-800">
          <div
            className="h-2 rounded-full bg-blue-500 transition-all"
            style={{ width: `${progress}%` }}
            aria-label={`progress-${project.project_id}`}
          />
        </div>
        <p className="text-xs text-gray-300">
          {project.task_done_count}/{project.task_count} tasks done
        </p>
      </div>

      <p className={`text-xs ${project.risk_open_count > 0 ? "text-red-300" : "text-gray-300"}`}>
        {project.risk_open_count} open risks
      </p>

      <p className="text-xs text-gray-300">
        Next milestone: {project.next_milestone ? project.next_milestone : "None"}
      </p>
      <p className="text-xs text-gray-400">{formatDateRange(project.start_date, project.target_date)}</p>
    </article>
  );
}

export default ProjectCard;
