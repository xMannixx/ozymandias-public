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

function DashboardView(): JSX.Element {
  const { stats, loading, error, autoRefresh, setAutoRefresh } = useDashboard();

  if (loading && !stats) {
    return (
      <div className="glass-card flex justify-center p-6">
        <Spinner />
      </div>
    );
  }

  if (!stats) {
    return <p className="glass-card p-4 text-sm text-red-300">{error ?? "Dashboard nicht verfuegbar"}</p>;
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
          Auto-Refresh (30s)
        </label>
      </div>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      {/* KPI Header Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Governance Health</p>
            <p className="text-xl font-extrabold text-emerald-400 mt-1">98%</p>
          </div>
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 shadow-[0_0_8px_#10b981]"></span>
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
          <span className="text-[10px] font-bold text-purple-300 bg-purple-950/40 border border-purple-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider">{stats.proposals_pending} neu</span>
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
