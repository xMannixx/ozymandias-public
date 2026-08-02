import { useNavigate } from "react-router-dom";
import GlassCard from "@/components/common/GlassCard";

type ClaimsSummaryProps = {
  claimsTotal: number;
  verification: Record<string, number>;
  sensitivity: Record<string, number>;
};

const verificationStates = ["tentative", "confirmed", "superseded", "retracted"] as const;
const sensitivityLevels = ["S0", "S1", "S2", "S3", "S4"] as const;

const sensitivityColor: Record<string, string> = {
  S0: "bg-zinc-500",
  S1: "bg-emerald-500",
  S2: "bg-sky-500",
  S3: "bg-amber-500",
  S4: "bg-rose-500",
};

const sensitivityHint: Record<string, string> = {
  S0: "Public",
  S1: "Internal",
  S2: "Confidential",
  S3: "Secret (local)",
  S4: "Isolated",
};

const stateLabel: Record<string, string> = {
  tentative: "Tentative",
  confirmed: "Confirmed",
  superseded: "Superseded",
  retracted: "Retracted",
};

function ClaimsSummary({ claimsTotal, verification, sensitivity }: ClaimsSummaryProps): JSX.Element {
  const navigate = useNavigate();
  const denominator = Math.max(1, claimsTotal);

  return (
    <GlassCard
      className="cursor-pointer space-y-4 md:col-span-2"
      onClick={() => navigate("/memory")}
    >
      <div className="flex items-baseline justify-between border-b border-white/[0.06] pb-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Memory</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-3xl font-semibold tracking-tight text-white">{claimsTotal}</span>
            <span className="text-sm text-zinc-400">total claims</span>
          </div>
        </div>
        <span className="text-xs text-zinc-500">Click to browse →</span>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Verification</p>
          <div className="space-y-2">
            {verificationStates.map((state) => {
              const value = verification[state] ?? 0;
              const percent = Math.round((value / denominator) * 100);
              return (
                <div key={state} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-300">{stateLabel[state] ?? state}</span>
                    <span className="text-zinc-400">
                      <span className="font-medium text-zinc-200">{value}</span>
                      <span className="ml-1 text-zinc-500">({percent}%)</span>
                    </span>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-white/[0.04]">
                    <div
                      className="h-full rounded-full bg-indigo-400/70 transition-[width] duration-500"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Sensitivity</p>
          <div className="space-y-2">
            {sensitivityLevels.map((level) => {
              const value = sensitivity[level] ?? 0;
              const percent = Math.round((value / denominator) * 100);
              return (
                <div key={level} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-zinc-300">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${sensitivityColor[level]}`}
                        aria-hidden="true"
                      />
                      {level}
                      <span className="text-zinc-500">· {sensitivityHint[level]}</span>
                    </span>
                    <span className="text-zinc-400">
                      <span className="font-medium text-zinc-200">{value}</span>
                      <span className="ml-1 text-zinc-500">({percent}%)</span>
                    </span>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-white/[0.04]">
                    <div
                      className={`h-full rounded-full ${sensitivityColor[level]}/60 transition-[width] duration-500`}
                      style={{ width: `${percent}%`, opacity: value === 0 ? 0.25 : 1 }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

export default ClaimsSummary;
