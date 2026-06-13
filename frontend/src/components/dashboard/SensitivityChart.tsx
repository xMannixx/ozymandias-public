import GlassCard from "@/components/common/GlassCard";
import { Cell, Legend, Pie, PieChart, Tooltip } from "recharts";

type SensitivityChartProps = {
  values: Record<string, number>;
};

const palette: Record<string, string> = {
  S0: "#8b949e",
  S1: "#3fb950",
  S2: "#58a6ff",
  S3: "#f0883e",
  S4: "#bc8cff",
};

const levels = ["S0", "S1", "S2", "S3", "S4"] as const;

function SensitivityChart({ values }: SensitivityChartProps): JSX.Element {
  const data = levels.map((level) => ({ name: level, value: values[level] ?? 0 }));

  return (
    <GlassCard className="space-y-2">
      <p className="text-sm font-medium text-gray-200">Sensitivity</p>
      <PieChart width={300} height={220}>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          isAnimationActive={false}
          cx={120}
          cy={100}
          innerRadius={45}
          outerRadius={75}
        >
          {data.map((entry) => (
            <Cell key={entry.name} fill={palette[entry.name]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </GlassCard>
  );
}

export default SensitivityChart;
