import GlassCard from "@/components/common/GlassCard";
import type { CircuitBreakerStatus } from "@/api/types";

type CircuitBreakerCardProps = {
  status: CircuitBreakerStatus;
};

function CircuitBreakerCard({ status }: CircuitBreakerCardProps): JSX.Element {
  const ratio = status.max_actions > 0 ? Math.min(100, Math.round((status.current_count / status.max_actions) * 100)) : 0;

  // Speedometer dimensions
  const width = 220;
  const height = 120;
  const cx = width / 2;
  const cy = height - 10;
  const rOuter = 85;
  const rInner = 65;
  const needleLength = 75;

  // Calculate needle tip: 180deg (left/low) to 0deg (right/limit)
  const angle = 180 - (ratio * 1.8);
  const rad = (angle * Math.PI) / 180;
  const x = cx + needleLength * Math.cos(rad);
  const y = cy - needleLength * Math.sin(rad);

  // Background arc path
  const arcBg = `M ${cx - rOuter} ${cy} A ${rOuter} ${rOuter} 0 0 1 ${cx + rOuter} ${cy} L ${cx + rInner} ${cy} A ${rInner} ${rInner} 0 0 0 ${cx - rInner} ${cy} Z`;

  // Active arc path (drawn clockwise from left tip to current angle)
  const fxOuter = cx + rOuter * Math.cos(rad);
  const fyOuter = cy - rOuter * Math.sin(rad);
  const fxInner = cx + rInner * Math.cos(rad);
  const fyInner = cy - rInner * Math.sin(rad);
  const arcFill = ratio > 0
    ? `M ${cx - rOuter} ${cy} A ${rOuter} ${rOuter} 0 0 1 ${fxOuter} ${fyOuter} L ${fxInner} ${fyInner} A ${rInner} ${rInner} 0 0 0 ${cx - rInner} ${cy} Z`
    : "";

  const badgeClass = status.is_tripped
    ? "bg-rose-950/40 border border-rose-500/30 text-rose-300 shadow-[0_0_10px_rgba(244,63,94,0.15)]"
    : "bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.15)]";

  return (
    <GlassCard className="space-y-4 border border-slate-800/80 bg-slate-950/30 backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
        <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Request limiting</p>
        <span className={`rounded-full px-3 py-0.5 text-[10px] font-bold tracking-wider ${badgeClass}`}>
          {status.is_tripped ? "TRIPPED" : "OK"}
        </span>
      </div>

      <div className="flex flex-col items-center justify-center pt-2">
        <div className="relative w-[220px] h-[120px]">
          <svg width={width} height={height} className="overflow-visible">
            <defs>
              <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="65%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#ef4444" />
              </linearGradient>
            </defs>
            {/* Background Arc */}
            <path d={arcBg} fill="rgba(30, 41, 59, 0.35)" stroke="rgba(51, 65, 85, 0.2)" strokeWidth="1" />
            
            {/* Active Arc Fill */}
            {ratio > 0 && (
              <path d={arcFill} fill="url(#gaugeGradient)" />
            )}
            
            {/* Pivot Center point */}
            <circle cx={cx} cy={cy} r="8" fill="#1e293b" />
            
            {/* Needle Line */}
            <line
              x1={cx}
              y1={cy}
              x2={x}
              y2={y}
              stroke="#58a6ff"
              strokeWidth="3.5"
              strokeLinecap="round"
              className="drop-shadow-[0_0_6px_rgba(88,166,255,0.6)]"
            />
            
            {/* Pivot Center Cap */}
            <circle cx={cx} cy={cy} r="4.5" fill="#58a6ff" />
          </svg>
          
          {/* Low and Limit markers */}
          <span className="absolute left-1 bottom-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Low</span>
          <span className="absolute right-1 bottom-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Limit</span>
        </div>

        {/* Current Traffic Info */}
        <div className="text-center mt-2 space-y-0.5">
          <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Usage (activity limit)</p>
          <p className="text-sm font-extrabold text-blue-300">
            {status.current_count} <span className="text-gray-500 font-semibold">/ {status.max_actions}</span>
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between text-[10px] text-gray-400 pt-1 border-t border-slate-800/40">
        <span>Zeitfenster: <strong className="text-gray-300">{status.window_seconds}s</strong></span>
        <span>Cooldown: <strong className="text-gray-300">{status.cooldown_seconds}s</strong></span>
      </div>
    </GlassCard>
  );
}

export default CircuitBreakerCard;

