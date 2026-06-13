import { useNavigate } from "react-router-dom";
import GlassCard from "@/components/common/GlassCard";

type StatsCardProps = {
  value: number | null | undefined;
  label: string;
  to?: string;
};

function StatsCard({ value, label, to }: StatsCardProps): JSX.Element {
  const navigate = useNavigate();
  const normalizedValue = value ?? 0;
  const clickable = Boolean(to);
  const handleClick = (): void => {
    if (to) {
      navigate(to);
    }
  };

  return (
    <GlassCard
      className={`space-y-2 ${clickable ? "cursor-pointer hover:border-blue-400/60" : ""}`}
      onClick={handleClick}
    >
      <p className="text-3xl font-semibold text-blue-200">{normalizedValue}</p>
      <p className="text-sm text-gray-300">{label}</p>
    </GlassCard>
  );
}

export default StatsCard;
