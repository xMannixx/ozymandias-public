import type { Sensitivity } from "@/api/types";

type BadgeProps = {
  sensitivity: Sensitivity | string;
};

const sensitivityStyles: Record<string, string> = {
  S0: "bg-gray-700 text-gray-200",
  S1: "bg-green-700 text-green-100",
  S2: "bg-blue-700 text-blue-100",
  S3: "bg-orange-700 text-orange-100",
  S4: "bg-purple-700 text-purple-100 ring-1 ring-purple-300",
};

function Badge({ sensitivity }: BadgeProps): JSX.Element {
  const style = sensitivityStyles[sensitivity] ?? sensitivityStyles.S1;
  return (
    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${style}`}>{sensitivity}</span>
  );
}

export default Badge;
