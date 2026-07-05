import { useNavigate } from "react-router-dom";
import GlassCard from "@/components/common/GlassCard";
import { RadialBarChart, RadialBar, Tooltip, ResponsiveContainer } from "recharts";

type ClaimsSummaryProps = {
  claimsTotal: number;
  verification: Record<string, number>;
  sensitivity: Record<string, number>;
};

const states = ["tentative", "confirmed", "superseded", "retracted"] as const;
const levels = ["S0", "S1", "S2", "S3", "S4"] as const;

const palette: Record<string, string> = {
  S0: "#94a3b8", // Vibrant silver
  S1: "#00ff87", // Neon green
  S2: "#00d2ff", // Neon cyan/blue
  S3: "#ff7b00", // Neon orange
  S4: "#d946ef", // Neon magenta
};

const stateLabels: Record<string, string> = {
  tentative: "Tentative",
  confirmed: "Confirmed",
  superseded: "Ersetzt",
  retracted: "Widerrufen",
};

function ClaimsSummary({ claimsTotal, verification, sensitivity }: ClaimsSummaryProps): JSX.Element {
  const navigate = useNavigate();
  const denominator = Math.max(1, claimsTotal);

  // Construct radial data for concentric rings (S0 inside, S4 outside)
  const radialData: { name: string; value: number; fill: string }[] = levels
    .map((level) => ({
      name: level,
      value: sensitivity[level] ?? 0,
      fill: palette[level],
    }))
    .filter((d) => d.value > 0);

  // Fallback: If no sensitivity data exists, show a neutral placeholder ring
  if (radialData.length === 0) {
    radialData.push({ name: "None", value: 1, fill: "#1e293b" });
  }

  return (
    <GlassCard
      className="space-y-4 md:col-span-2 cursor-pointer border border-slate-800/80 bg-slate-950/30 backdrop-blur-md hover:border-blue-400/40 hover:shadow-[0_0_20px_rgba(59,130,246,0.15)] transition-all duration-300"
      onClick={() => navigate("/memory")}
    >
      <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-gray-400 font-medium">Memory Status</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-4xl font-extrabold bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
              {claimsTotal}
            </span>
            <span className="text-sm font-semibold text-gray-300">Claims Gesamt</span>
          </div>
        </div>
        <div className="flex gap-2">
          {levels.map((level) => (
            <div key={level} className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: palette[level] }} />
              <span className="text-[10px] font-bold text-gray-400">{level}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 items-center">
        {/* Left Side: Verification bars */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Verifizierung</p>
          <div className="space-y-2.5">
            {states.map((state) => {
              const value = verification[state] ?? 0;
              const percent = Math.round((value / denominator) * 100);
              const width = `${percent}%`;
              return (
                <div key={state} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-300 font-medium">{stateLabels[state] || state}</span>
                    <span className="text-blue-300 font-bold">{value} <span className="text-[10px] text-gray-500 font-normal">({percent}%)</span></span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-900/60 overflow-hidden border border-slate-800/40">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 shadow-[0_0_8px_rgba(59,130,246,0.3)] transition-all duration-500"
                      style={{ width }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Side: Sensitivity Radial Bar Chart */}
        <div className="flex flex-col items-center justify-center space-y-2 border-t border-slate-800/40 pt-4 md:border-t-0 md:pt-0 md:border-l md:border-slate-800/40 md:pl-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider self-start">Sensitivity distribution</p>
          <div className="w-full h-[150px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                cx="50%"
                cy="50%"
                innerRadius="25%"
                outerRadius="95%"
                barSize={8}
                data={radialData}
                startAngle={90}
                endAngle={-270}
              >
                <RadialBar
                  background={{ fill: "rgba(30, 41, 59, 0.15)" }}
                  dataKey="value"
                  cornerRadius={4}
                />
                <Tooltip
                  contentStyle={{
                    background: "rgba(15, 23, 42, 0.9)",
                    border: "1px solid rgba(51, 65, 85, 0.5)",
                    borderRadius: "8px",
                    fontSize: "12px",
                    color: "#f8fafc",
                  }}
                />
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

export default ClaimsSummary;
