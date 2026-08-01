import { useNavigate } from "react-router-dom";
import GlassCard from "@/components/common/GlassCard";

type ProjectsSummaryProps = {
  projectsActive: number;
  tasksOpen: number;
  risksCritical: number;
  nextMilestone: string | null;
};

function ProjectsSummary({
  projectsActive,
  tasksOpen,
  risksCritical,
  nextMilestone,
}: ProjectsSummaryProps): JSX.Element {
  const navigate = useNavigate();

  return (
    <GlassCard
      className="cursor-pointer space-y-2 transition hover:border-blue-500/60"
      onClick={() => navigate("/projects")}
      data-testid="projects-summary-card"
    >
      <h3 className="text-sm font-semibold text-blue-200">Projects</h3>
      <p className="text-3xl font-semibold text-blue-100">{projectsActive} active projects</p>
      <p className="text-sm text-gray-300">{tasksOpen} open tasks</p>
      <p className={`text-sm ${risksCritical > 0 ? "text-red-300" : "text-gray-300"}`}>
        {risksCritical} critical risks
      </p>
      <p className="text-xs text-gray-400">
        Next milestone: {nextMilestone ? nextMilestone : "none"}
      </p>
    </GlassCard>
  );
}

export default ProjectsSummary;
