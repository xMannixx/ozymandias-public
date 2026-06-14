import GlassCard from "@/components/common/GlassCard";
import type { CircuitBreakerStatus } from "@/api/types";

type CircuitBreakerCardProps = {
  status: CircuitBreakerStatus;
};

function CircuitBreakerCard({ status }: CircuitBreakerCardProps): JSX.Element {
  const ratio = status.max_actions > 0 ? Math.min(100, Math.round((status.current_count / status.max_actions) * 100)) : 0;

  // Determine indicator color based on ratio and trip status
  const barColor = status.is_tripped
    ? "from-rose-600 to-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.3)]"
    : ratio > 80
    ? "from-amber-500 to-rose-500 shadow-[0_0_8px_rgba(245,158,11,0.3)]"
    : "from-emerald-500 to-teal-400 shadow-[0_0_8px_rgba(16,185,129,0.3)]";

  const badgeClass = status.is_tripped
    ? "bg-rose-950/40 border border-rose-500/30 text-rose-300 shadow-[0_0_10px_rgba(244,63,94,0.15)]"
    : "bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.15)]";

  return (
    <GlassCard className="space-y-4 border border-slate-800/80 bg-slate-950/30 backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
        <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Anfragenbegrenzung</p>
        <span className={`rounded-full px-3 py-0.5 text-[10px] font-bold tracking-wider ${badgeClass}`}>
          {status.is_tripped ? "TRIPPED" : "OK"}
        </span>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-300 font-medium">Auslastung (Aktivitäts-Limit)</span>
          <span className="text-blue-300 font-bold">
            {status.current_count} <span className="text-gray-500 font-normal">/ {status.max_actions}</span>
          </span>
        </div>
        <div className="h-2 rounded-full bg-slate-900/60 overflow-hidden border border-slate-800/40 p-[1px]">
          <div
            className={`h-full rounded-full bg-gradient-to-r transition-all duration-500 ${barColor}`}
            style={{ width: `${ratio}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-[10px] text-gray-400 pt-1">
        <span>Zeitfenster: <strong className="text-gray-300">{status.window_seconds}s</strong></span>
        <span>Abkühlzeit: <strong className="text-gray-300">{status.cooldown_seconds}s</strong></span>
      </div>
    </GlassCard>
  );
}

export default CircuitBreakerCard;
