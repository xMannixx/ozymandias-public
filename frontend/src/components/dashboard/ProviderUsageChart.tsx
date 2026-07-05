import GlassCard from "@/components/common/GlassCard";
import { Bar, BarChart, CartesianGrid, Cell, Tooltip, XAxis, YAxis } from "recharts";

type ProviderUsageChartProps = {
  usage: Record<string, number>;
};

const providerColors: Record<string, string> = {
  deepseek: "#58a6ff",
  gemini: "#3fb950",
  openai: "#f0883e",
  ollama: "#bc8cff",
};

function ProviderUsageChart({ usage }: ProviderUsageChartProps): JSX.Element {
  const entries = Object.entries(usage).map(([provider, value]) => ({ provider, value }));

  return (
    <GlassCard className="space-y-2">
      <p className="text-sm font-medium text-gray-200">Provider Usage</p>
      {entries.length === 0 ? (
        <p className="text-sm text-gray-400">No data</p>
      ) : (
        <BarChart width={320} height={220} data={entries}>
          <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
          <XAxis dataKey="provider" stroke="#8b949e" />
          <YAxis stroke="#8b949e" />
          <Tooltip />
          <Bar dataKey="value">
            {entries.map((entry) => (
              <Cell key={entry.provider} fill={providerColors[entry.provider] ?? "#58a6ff"} />
            ))}
          </Bar>
        </BarChart>
      )}
    </GlassCard>
  );
}

export default ProviderUsageChart;
