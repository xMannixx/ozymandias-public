import GlassCard from "@/components/common/GlassCard";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type ProviderUsageChartProps = {
  usage: Record<string, number>;
};

const providerColors: Record<string, string> = {
  deepseek: "#818cf8",
  gemini: "#34d399",
  openai: "#fbbf24",
  ollama: "#a78bfa",
  mistral: "#60a5fa",
  lmstudio: "#f472b6",
};

function ProviderUsageChart({ usage }: ProviderUsageChartProps): JSX.Element {
  const entries = Object.entries(usage).map(([provider, value]) => ({ provider, value }));

  return (
    <GlassCard className="space-y-3 p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Provider usage</p>
      {entries.length === 0 ? (
        <p className="text-sm text-zinc-500">No data yet.</p>
      ) : (
        <ResponsiveContainer width="100%" height={200} initialDimension={{ width: 320, height: 200 }}>
          <BarChart data={entries} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis
              dataKey="provider"
              stroke="#71717a"
              tick={{ fontSize: 11 }}
              axisLine={{ stroke: "rgba(255,255,255,0.05)" }}
              tickLine={false}
            />
            <YAxis
              stroke="#71717a"
              tick={{ fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.03)" }}
              contentStyle={{
                background: "#131318",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                fontSize: 12,
                color: "#f4f4f5",
              }}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {entries.map((entry) => (
                <Cell key={entry.provider} fill={providerColors[entry.provider] ?? "#818cf8"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </GlassCard>
  );
}

export default ProviderUsageChart;
