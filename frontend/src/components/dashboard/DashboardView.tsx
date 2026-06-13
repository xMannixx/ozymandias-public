import CircuitBreakerCard from "@/components/dashboard/CircuitBreakerCard";
import ClaimsSummary from "@/components/dashboard/ClaimsSummary";
import ContactsSummary from "@/components/dashboard/ContactsSummary";
import ModeSwitch from "@/components/dashboard/ModeSwitch";
import ProposalsSummary from "@/components/dashboard/ProposalsSummary";
import ProjectsSummary from "@/components/dashboard/ProjectsSummary";
import ProviderUsageChart from "@/components/dashboard/ProviderUsageChart";
import RecentActionsCard from "@/components/dashboard/RecentActionsCard";
import SensitivityChart from "@/components/dashboard/SensitivityChart";
import StatsCard from "@/components/dashboard/StatsCard";
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <ClaimsSummary
          claimsTotal={stats.claims_total}
          verification={stats.claims_by_verification}
        />
        <StatsCard value={stats.claims_total} label="Claims Gesamt" to="/memory" />
        <ProposalsSummary pending={stats.proposals_pending} total={stats.proposals_total} />
        <ProjectsSummary
          projectsActive={stats.projects_active}
          tasksOpen={stats.projects_tasks_open}
          risksCritical={stats.projects_risks_critical}
          nextMilestone={stats.projects_next_milestone}
        />
        <ContactsSummary contactsTotal={stats.contacts_total} />
        <SensitivityChart values={stats.claims_by_sensitivity} />
        <CircuitBreakerCard status={stats.circuit_breaker} />
        <ProviderUsageChart usage={stats.provider_usage} />
        <RecentActionsCard entries={stats.recent_actions} />
        <ModeSwitch />
        <SystemHealth />
      </div>
    </section>
  );
}

export default DashboardView;
