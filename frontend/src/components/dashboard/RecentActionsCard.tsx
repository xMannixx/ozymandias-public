import { Link } from "react-router-dom";
import GlassCard from "@/components/common/GlassCard";
import type { AuditEntryResponse } from "@/api/types";

type RecentActionsCardProps = {
  entries: AuditEntryResponse[];
};

function RecentActionsCard({ entries }: RecentActionsCardProps): JSX.Element {
  const visibleEntries = entries.slice(0, 10);

  const getEventBadge = (eventType: string) => {
    let colors = "border-slate-800 text-gray-400 bg-slate-900/60";
    let label = eventType;

    switch (eventType) {
      case "turn_processed":
        colors = "border-blue-500/30 text-blue-400 bg-blue-950/20";
        label = "Anfrage verarbeitet";
        break;
      case "memory_confirmed":
        colors = "border-emerald-500/30 text-emerald-400 bg-emerald-950/20 shadow-[0_0_8px_rgba(16,185,129,0.1)]";
        label = "Claim bestätigt";
        break;
      case "memory_rejected":
        colors = "border-rose-500/30 text-rose-400 bg-rose-950/20 shadow-[0_0_8px_rgba(244,63,94,0.1)]";
        label = "Claim abgelehnt";
        break;
      case "memory_superseded":
        colors = "border-amber-500/30 text-amber-400 bg-amber-950/20";
        label = "Claim überschrieben";
        break;
      case "memory_retracted":
        colors = "border-orange-500/30 text-orange-400 bg-orange-950/20";
        label = "Claim zurückgezogen";
        break;
      case "action_executed":
        colors = "border-purple-500/30 text-purple-400 bg-purple-950/20";
        label = "Aktion ausgeführt";
        break;
      case "action_blocked":
        colors = "border-rose-500/30 text-rose-400 bg-rose-950/20 animate-pulse";
        label = "Aktion blockiert";
        break;
    }

    return (
      <span className={`border rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide ${colors}`}>
        {label}
      </span>
    );
  };

  return (
    <GlassCard className="space-y-4 md:col-span-2 xl:col-span-3 border border-slate-800/80 bg-slate-950/30 backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
        <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Governance-Protokoll (Audit Log)</p>
        <Link to="/audit" className="text-xs text-blue-300 hover:text-blue-200 hover:underline transition-all font-semibold">
          Alle anzeigen
        </Link>
      </div>

      <ul className="relative border-l border-slate-800/80 ml-2 pl-4 space-y-4 py-1">
        {visibleEntries.length > 0 ? (
          visibleEntries.map((entry) => (
            <li key={entry.audit_id} className="relative flex items-center justify-between gap-4 group">
              {/* Timeline Bullet */}
              <span className="absolute -left-[21.5px] h-2.5 w-2.5 rounded-full border border-slate-950 bg-slate-800 group-hover:bg-blue-400 group-hover:scale-125 transition-all duration-300" />
              
              <div className="flex items-center gap-3">
                {getEventBadge(entry.event_type)}
                <span className="text-[10px] text-gray-500 max-w-[200px] sm:max-w-[400px] truncate group-hover:text-gray-300 transition-colors">
                  ID: {entry.audit_id.slice(0, 8)}... | {entry.user_id}
                </span>
              </div>
              <span className="text-[10px] text-gray-500 group-hover:text-gray-400 font-medium">
                {new Date(entry.created_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
            </li>
          ))
        ) : (
          <li className="text-xs text-gray-500 py-2">Keine Protokolleinträge vorhanden.</li>
        )}
      </ul>
    </GlassCard>
  );
}

export default RecentActionsCard;
