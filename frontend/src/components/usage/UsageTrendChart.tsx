import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { UsageBucket } from "@/api/types";
import { formatBucketLabel, formatTokens } from "@/lib/usageFormat";

type UsageTrendChartProps = {
  series: UsageBucket[];
  bucketUnit: "hour" | "day";
};

function UsageTrendChart({ series, bucketUnit }: UsageTrendChartProps): JSX.Element {
  const data = series.map((bucket) => ({
    label: formatBucketLabel(bucket.bucket, bucketUnit),
    tokens: bucket.tokens,
    errors: bucket.errors,
  }));

  return (
    <section className="glass-card space-y-3 p-4">
      <div className="space-y-0.5">
        <h3 className="text-sm font-medium text-zinc-200">Tokens over time</h3>
        <p className="text-xs text-zinc-500">
          {bucketUnit === "hour" ? "One point per hour" : "One point per day"}, with failed calls marked
          on top.
        </p>
      </div>
      {data.length === 0 ? (
        <p className="text-sm text-zinc-500">Nothing recorded in this range yet.</p>
      ) : (
        <ResponsiveContainer width="100%" height={220} initialDimension={{ width: 640, height: 220 }}>
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
            <defs>
              <linearGradient id="usage-tokens" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#818cf8" stopOpacity={0.45} />
                <stop offset="100%" stopColor="#818cf8" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis
              dataKey="label"
              stroke="#71717a"
              tick={{ fontSize: 11 }}
              axisLine={{ stroke: "rgba(255,255,255,0.05)" }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              stroke="#71717a"
              tick={{ fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value: number) => formatTokens(value)}
            />
            <Tooltip
              cursor={{ stroke: "rgba(255,255,255,0.12)" }}
              contentStyle={{
                background: "#131318",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                fontSize: 12,
                color: "#f4f4f5",
              }}
              formatter={(value, name) => {
                const numeric = typeof value === "number" ? value : Number(value ?? 0);
                if (name === "tokens") {
                  return [formatTokens(numeric), "tokens"];
                }
                if (name === "errors") {
                  return [String(numeric), "failed calls"];
                }
                return [String(numeric), String(name)];
              }}
            />
            <Area
              type="monotone"
              dataKey="tokens"
              stroke="#818cf8"
              strokeWidth={1.5}
              fill="url(#usage-tokens)"
            />
            <Line type="monotone" dataKey="errors" stroke="#fb7185" strokeWidth={1.5} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </section>
  );
}

export default UsageTrendChart;
