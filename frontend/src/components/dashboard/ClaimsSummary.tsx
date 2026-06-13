import { useNavigate } from "react-router-dom";
import GlassCard from "@/components/common/GlassCard";

type ClaimsSummaryProps = {
  claimsTotal: number;
  verification: Record<string, number>;
};

const states = ["tentative", "confirmed", "superseded", "retracted"] as const;

function ClaimsSummary({ claimsTotal, verification }: ClaimsSummaryProps): JSX.Element {
  const navigate = useNavigate();
  const denominator = Math.max(1, claimsTotal);

  return (
    <GlassCard className="space-y-3 md:col-span-2 cursor-pointer hover:border-blue-400/60" onClick={() => navigate("/memory")}>
      <div>
        <p className="text-xs uppercase tracking-wide text-gray-400">Claims Total</p>
        <p className="text-3xl font-semibold text-blue-200">{claimsTotal}</p>
      </div>
      <div className="space-y-2">
        {states.map((state) => {
          const value = verification[state] ?? 0;
          const width = `${Math.round((value / denominator) * 100)}%`;
          return (
            <div key={state} className="space-y-1">
              <div className="flex items-center justify-between text-xs text-gray-300">
                <span>{state}</span>
                <span>{value}</span>
              </div>
              <div className="h-2 rounded bg-gray-800">
                <div className="h-2 rounded bg-blue-500" style={{ width }} />
              </div>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}

export default ClaimsSummary;
