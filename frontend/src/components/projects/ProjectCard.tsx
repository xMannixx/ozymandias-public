import { Link } from "react-router-dom";
import Button from "@/components/common/Button";
import type { ProjectResponse, ProjectStatus } from "@/api/types";

type ProjectCardProps = {
  project: ProjectResponse;
  onDelete: (projectId: string) => void;
};

const statusLabel: Record<ProjectStatus, string> = {
  active: "Active",
  paused: "Paused",
  completed: "Completed",
  cancelled: "Cancelled",
};

const statusClass: Record<ProjectStatus, string> = {
  active: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
  paused: "border-amber-400/25 bg-amber-400/10 text-amber-200",
  completed: "border-white/[0.09] bg-white/[0.03] text-zinc-300",
  cancelled: "border-red-400/25 bg-red-400/10 text-red-200",
};

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

/** One workspace at a glance: what it holds, and what is due next. */
function ProjectCard({ project, onDelete }: ProjectCardProps): JSX.Element {
  const progress =
    project.task_count > 0
      ? clampPercent(Math.round((project.task_done_count / project.task_count) * 100))
      : 0;
  const keepsLocal = project.sensitivity === "S3" || project.sensitivity === "S4";
  const contents = [
    project.instructions ? "instructions" : null,
    project.knowledge_count > 0
      ? `${project.knowledge_count.toString()} ${project.knowledge_count === 1 ? "file" : "files"}`
      : null,
    project.chat_count > 0
      ? `${project.chat_count.toString()} ${project.chat_count === 1 ? "chat" : "chats"}`
      : null,
  ].filter((part): part is string => part !== null);

  return (
    <article className="glass-card flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <Link
          to={`/projects/${project.project_id}`}
          className="min-w-0 flex-1 text-base font-medium text-zinc-100 hover:text-white"
        >
          <span className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: project.color ?? "#7c8cff" }}
            />
            <span className="line-clamp-2">{project.name}</span>
          </span>
        </Link>
        <Button
          type="button"
          variant="ghost"
          className="h-8 shrink-0 px-2 py-0 text-xs text-red-200 hover:text-red-100"
          aria-label={`Delete ${project.name}`}
          onClick={() => onDelete(project.project_id)}
        >
          Delete
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={`rounded-full border px-2 py-0.5 ${statusClass[project.status]}`}>
          {statusLabel[project.status]}
        </span>
        {keepsLocal ? (
          <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-0.5 text-emerald-200">
            Local only
          </span>
        ) : null}
      </div>

      <p className="text-xs text-zinc-500">
        {contents.length > 0 ? `Holds ${contents.join(", ")}.` : "Empty workspace so far."}
      </p>

      {project.task_count > 0 ? (
        <div className="space-y-1">
          <div className="h-1.5 rounded-full bg-white/[0.06]">
            <div
              className="h-1.5 rounded-full bg-indigo-400 transition-all"
              style={{ width: `${progress.toString()}%` }}
              aria-label={`progress-${project.project_id}`}
            />
          </div>
          <p className="text-xs text-zinc-500">
            {project.task_done_count} of {project.task_count} tasks done
          </p>
        </div>
      ) : null}

      {project.next_due_task ? (
        <p className="text-xs text-zinc-400">Next up: {project.next_due_task}</p>
      ) : null}

      <Link
        to={`/projects/${project.project_id}`}
        className="mt-auto text-xs text-indigo-300 hover:underline"
      >
        Open workspace →
      </Link>
    </article>
  );
}

export default ProjectCard;
