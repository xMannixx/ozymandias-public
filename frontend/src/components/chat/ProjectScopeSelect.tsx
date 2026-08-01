import type { ProjectResponse } from "@/api/types";

type ProjectScopeSelectProps = {
  projects: ProjectResponse[];
  projectId: string | null;
  onChange: (projectId: string | null) => void;
};

/**
 * Picks the workspace a chat happens in. Choosing one makes Ozy read that
 * project's instructions and files before answering.
 */
function ProjectScopeSelect({
  projects,
  projectId,
  onChange,
}: ProjectScopeSelectProps): JSX.Element {
  return (
    <label className="flex flex-col gap-1 text-xs text-zinc-400">
      Workspace
      <select
        aria-label="chat-project-select"
        value={projectId ?? "none"}
        onChange={(event) => onChange(event.target.value === "none" ? null : event.target.value)}
      >
        <option value="none">No workspace (general chat)</option>
        {projects.map((project) => (
          <option key={project.project_id} value={project.project_id}>
            {project.name}
          </option>
        ))}
      </select>
      <span className="text-[11px] text-zinc-500">
        Inside a workspace Ozy uses its instructions and knowledge.
      </span>
    </label>
  );
}

export default ProjectScopeSelect;
