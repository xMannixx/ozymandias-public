import GlassCard from "@/components/common/GlassCard";
import type { CircuitBreakerStatus } from "@/api/types";

type CircuitBreakerCardProps = {
  status: CircuitBreakerStatus;
};

function CircuitBreakerCard({ status }: CircuitBreakerCardProps): JSX.Element {
  const ratio = status.max_actions > 0 ? Math.min(100, Math.round((status.current_count / status.max_actions) * 100)) : 0;

  return (
    <GlassCard className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-200">Circuit Breaker</p>
        <span className={`rounded px-2 py-1 text-xs font-semibold ${status.is_tripped ? "bg-red-700 text-red-100" : "bg-green-700 text-green-100"}`}>
          {status.is_tripped ? "TRIPPED" : "OK"}
        </span>
      </div>

      <div className="space-y-1">
        <div className="h-2 rounded bg-gray-800">
          <div className={`h-2 rounded ${status.is_tripped ? "bg-red-500" : "bg-green-500"}`} style={{ width: `${ratio}%` }} />
        </div>
        <p className="text-xs text-gray-300">
          {status.current_count}/{status.max_actions}
        </p>
      </div>

      <p className="text-xs text-gray-400">
        Window: {status.window_seconds}s | Cooldown: {status.cooldown_seconds}s
      </p>
    </GlassCard>
  );
}

export default CircuitBreakerCard;
