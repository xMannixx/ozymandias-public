import { Link } from "react-router-dom";
import GlassCard from "@/components/common/GlassCard";
import type { AuditEntryResponse } from "@/api/types";

type RecentActionsCardProps = {
  entries: AuditEntryResponse[];
};

function RecentActionsCard({ entries }: RecentActionsCardProps): JSX.Element {
  const visibleEntries = entries.slice(0, 10);
  return (
    <GlassCard className="space-y-3 md:col-span-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-200">Recent Actions</p>
        <Link to="/audit" className="text-xs text-blue-300 hover:underline">
          Alle anzeigen
        </Link>
      </div>

      <ul className="space-y-2">
        {visibleEntries.map((entry) => (
          <li key={entry.audit_id} className="flex items-center justify-between gap-2 text-xs">
            <span className="text-gray-300">{entry.event_type}</span>
            <span className="text-gray-500">{new Date(entry.created_at).toLocaleTimeString()}</span>
          </li>
        ))}
      </ul>
    </GlassCard>
  );
}

export default RecentActionsCard;
