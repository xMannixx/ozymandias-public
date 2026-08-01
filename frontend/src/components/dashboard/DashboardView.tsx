import CircuitBreakerCard from "@/components/dashboard/CircuitBreakerCard";
import ClaimsSummary from "@/components/dashboard/ClaimsSummary";
import ContactsSummary from "@/components/dashboard/ContactsSummary";
import ModeSwitch from "@/components/dashboard/ModeSwitch";
import ProposalsSummary from "@/components/dashboard/ProposalsSummary";
import ProjectsSummary from "@/components/dashboard/ProjectsSummary";
import ProviderUsageChart from "@/components/dashboard/ProviderUsageChart";
import RecentActionsCard from "@/components/dashboard/RecentActionsCard";
import SystemHealth from "@/components/dashboard/SystemHealth";
import Spinner from "@/components/common/Spinner";
import { useDashboard } from "@/hooks/useDashboard";
import { useHealth } from "@/hooks/useHealth";

function DashboardView(): JSX.Element {
  const { stats, loading, error, autoRefresh, setAutoRefresh, refetch } = useDashboard();
  const { health } = useHealth();
  const systemHealthy = health !== null && health.status === "ok";
  const healthLabel = health === null ? "..." : systemHealthy ? "Healthy" : "Degraded";

  if (loading && !stats) {
    return (
      <div className="glass-card flex justify-center p-6" role="status" aria-live="polite">
        <Spinner />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="glass-card flex flex-col items-start gap-2 p-4" role="alert">
        <p className="text-sm text-red-300">
          Dashboard unavailable. {error ?? "Could not load dashboard data."}
        </p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="rounded border border-blue-500/40 px-3 py-1 text-xs text-blue-200 hover:bg-blue-900/40"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-blue-200">Dashboard</h2>
        <label className="flex items-center gap-2 text-sm text-gray-300">
          <input
            aria-label="dashboard-auto-refresh"
            type="checkbox"
            checked={autoRefresh}
            onChange={(event) => setAutoRefresh(event.target.checked)}
            className="h-4 w-4 accent-blue-500"
          />
          Auto-refresh (30s)
        </label>
      </div>

      {error ? (
        <p className="text-xs text-amber-300" role="status" aria-live="polite">
          Latest refresh failed ({error}). Showing the last successful snapshot.
        </p>
      ) : null}

      {/* KPI Header Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">System Health</p>
            <p className={`text-xl font-extrabold mt-1 ${systemHealthy ? "text-emerald-400" : "text-amber-400"}`}>{healthLabel}</p>
          </div>
          <span className="relative flex h-3 w-3">
            {systemHealthy ? (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            ) : null}
            <span
              className={`relative inline-flex rounded-full h-3 w-3 ${
                systemHealthy ? "bg-emerald-500 shadow-[0_0_8px_#10b981]" : "bg-amber-500 shadow-[0_0_8px_#f59e0b]"
              }`}
            ></span>
          </span>
        </div>
        <div className="glass-card p-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Total Claims</p>
            <p className="text-xl font-extrabold text-blue-400 mt-1">{stats.claims_total}</p>
          </div>
          <span className="text-[10px] font-bold text-blue-300 bg-blue-950/40 border border-blue-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider">Active</span>
        </div>
        <div className="glass-card p-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Pending Proposals</p>
            <p className="text-xl font-extrabold text-purple-400 mt-1">{stats.proposals_pending}</p>
          </div>
          <span className="text-[10px] font-bold text-purple-300 bg-purple-950/40 border border-purple-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider">{stats.proposals_pending} new</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <ClaimsSummary
          claimsTotal={stats.claims_total}
          verification={stats.claims_by_verification}
          sensitivity={stats.claims_by_sensitivity}
        />
        <SystemHealth />

        <ProposalsSummary pending={stats.proposals_pending} total={stats.proposals_total} />
        <CircuitBreakerCard status={stats.circuit_breaker} />
        <ModeSwitch />

        <ProjectsSummary
          projectsActive={stats.projects_active}
          tasksOpen={stats.projects_tasks_open}
          risksCritical={stats.projects_risks_critical}
          nextMilestone={stats.projects_next_milestone}
        />
        <ContactsSummary contactsTotal={stats.contacts_total} />
        <ProviderUsageChart usage={stats.provider_usage} />

        <RecentActionsCard entries={stats.recent_actions} />
      </div>
    </section>
  );
}

export default DashboardView;
