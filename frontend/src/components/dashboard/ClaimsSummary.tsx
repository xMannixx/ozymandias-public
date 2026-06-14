import { useNavigate } from "react-router-dom";
import GlassCard from "@/components/common/GlassCard";
import { Cell, Pie, PieChart, Tooltip, ResponsiveContainer } from "recharts";

type ClaimsSummaryProps = {
  claimsTotal: number;
  verification: Record<string, number>;
  sensitivity: Record<string, number>;
};

const states = ["tentative", "confirmed", "superseded", "retracted"] as const;
const levels = ["S0", "S1", "S2", "S3", "S4"] as const;

const palette: Record<string, string> = {
  S0: "#8b949e",
  S1: "#3fb950",
  S2: "#58a6ff",
  S3: "#f0883e",
  S4: "#bc8cff",
};

const stateLabels: Record<string, string> = {
  tentative: "Vorläufig",
  confirmed: "Bestätigt",
  superseded: "Ersetzt",
  retracted: "Widerrufen",
};

function ClaimsSummary({ claimsTotal, verification, sensitivity }: ClaimsSummaryProps): JSX.Element {
  const navigate = useNavigate();
  const denominator = Math.max(1, claimsTotal);

  const pieData = levels
    .map((level) => ({ name: level, value: sensitivity[level] ?? 0 }))
    .filter((d) => d.value > 0);

  // Fallback: If no sensitivity data exists, show a neutral placeholder ring
  if (pieData.length === 0) {
    pieData.push({ name: "Keine", value: 1 });
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

        {/* Right Side: Sensitivity Pie Chart */}
        <div className="flex flex-col items-center justify-center space-y-2 border-t border-slate-800/40 pt-4 md:border-t-0 md:pt-0 md:border-l md:border-slate-800/40 md:pl-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider self-start">Sensitivitätsverteilung</p>
          <div className="w-full h-[150px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={38}
                  outerRadius={58}
                  paddingAngle={3}
                >
                  {pieData.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={entry.name === "Keine" ? "#1e293b" : palette[entry.name] || "#1e293b"}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "rgba(15, 23, 42, 0.9)",
                    border: "1px solid rgba(51, 65, 85, 0.5)",
                    borderRadius: "8px",
                    fontSize: "12px",
                    color: "#f8fafc",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

export default ClaimsSummary;
