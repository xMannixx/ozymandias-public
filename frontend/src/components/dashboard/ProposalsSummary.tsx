import { useNavigate } from "react-router-dom";
import GlassCard from "@/components/common/GlassCard";

type ProposalsSummaryProps = {
  pending: number;
  total: number;
};

function ProposalsSummary({ pending, total }: ProposalsSummaryProps): JSX.Element {
  const navigate = useNavigate();
  const pendingClass = pending > 0 ? "text-orange-300 neon-glow-orange rounded px-2 py-1" : "text-blue-200";

  return (
    <GlassCard className="cursor-pointer space-y-2 hover:border-blue-400/60" onClick={() => navigate("/proposals")}>
      <p className="text-xs uppercase tracking-wide text-gray-400">Proposals</p>
      <p className={`text-3xl font-semibold ${pendingClass}`}>{pending}</p>
      <p className="text-sm text-gray-300">Total: {total}</p>
    </GlassCard>
  );
}

export default ProposalsSummary;
