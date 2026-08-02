import { useNavigate } from "react-router-dom";
import GlassCard from "@/components/common/GlassCard";

type ProjectsSummaryProps = {
  projectsActive: number;
  tasksOpen: number;
  knowledgeFiles: number;
  nextDueTask: string | null;
};

function ProjectsSummary({
  projectsActive,
  tasksOpen,
  knowledgeFiles,
  nextDueTask,
}: ProjectsSummaryProps): JSX.Element {
  const navigate = useNavigate();

  return (
    <GlassCard
      className="cursor-pointer space-y-2"
      onClick={() => navigate("/projects")}
      data-testid="projects-summary-card"
    >
      <h3 className="text-sm font-medium text-zinc-400">Workspaces</h3>
      <p className="text-3xl font-semibold text-zinc-100">{projectsActive} active</p>
      <p className="text-sm text-zinc-400">{tasksOpen} open tasks</p>
      <p className="text-sm text-zinc-400">
        {knowledgeFiles} {knowledgeFiles === 1 ? "file" : "files"} Ozy can quote
      </p>
      <p className="text-xs text-zinc-500">
        {nextDueTask ? `Next up: ${nextDueTask}` : "Nothing with a deadline"}
      </p>
    </GlassCard>
  );
}

export default ProjectsSummary;
