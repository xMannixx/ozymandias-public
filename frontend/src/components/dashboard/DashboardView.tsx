import type { ReactNode } from "react";
import { Activity, Brain, RefreshCw, Sparkles } from "lucide-react";
import CircuitBreakerCard from "@/components/dashboard/CircuitBreakerCard";
import ClaimsSummary from "@/components/dashboard/ClaimsSummary";
import ContactsSummary from "@/components/dashboard/ContactsSummary";
import ModeSwitch from "@/components/dashboard/ModeSwitch";
import ProposalsSummary from "@/components/dashboard/ProposalsSummary";
import ProjectsSummary from "@/components/dashboard/ProjectsSummary";
import RecentActionsCard from "@/components/dashboard/RecentActionsCard";
import SystemHealth from "@/components/dashboard/SystemHealth";
import UsageSummary from "@/components/dashboard/UsageSummary";
import Spinner from "@/components/common/Spinner";
import { useDashboard } from "@/hooks/useDashboard";
import { useHealth } from "@/hooks/useHealth";

type KpiTileProps = {
  label: string;
  value: string | number;
  hint?: string;
  icon: JSX.Element;
  tone: "neutral" | "success" | "warning" | "accent";
};

const toneToDot: Record<KpiTileProps["tone"], string> = {
  neutral: "bg-zinc-500",
  success: "bg-emerald-400",
  warning: "bg-amber-400",
  accent: "bg-indigo-400",
};

function KpiTile({ label, value, hint, icon, tone }: KpiTileProps): JSX.Element {
  return (
    <div className="glass-card flex items-start justify-between p-4">
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-2 text-xs font-medium text-zinc-400">
          <span className={`h-1.5 w-1.5 rounded-full ${toneToDot[tone]}`} aria-hidden="true" />
          <span>{label}</span>
        </div>
        <div className="text-2xl font-semibold tracking-tight text-white">{value}</div>
        {hint ? <div className="text-xs text-zinc-500">{hint}</div> : null}
      </div>
      <div className="flex h-8 w-8 items-center justify-center rounded-md border border-white/[0.06] bg-white/[0.02] text-zinc-400">
        {icon}
      </div>
    </div>
  );
}

type DashboardSectionProps = {
  title: string;
  description: string;
  children: ReactNode;
};

function DashboardSection({ title, description, children }: DashboardSectionProps): JSX.Element {
  return (
    <section className="space-y-3">
      <div className="space-y-0.5">
        <h3 className="text-sm font-medium text-zinc-300">{title}</h3>
        <p className="text-xs text-zinc-500">{description}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">{children}</div>
    </section>
  );
}

function DashboardView(): JSX.Element {
  const { stats, loading, error, autoRefresh, setAutoRefresh, refetch } = useDashboard();
  const { health } = useHealth();
  const systemHealthy = health !== null && health.status === "ok";
  const healthLabel = health === null ? "…" : systemHealthy ? "Healthy" : "Degraded";

  if (loading && !stats) {
    return (
      <div className="glass-card flex justify-center p-6" role="status" aria-live="polite">
        <Spinner />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="glass-card flex flex-col items-start gap-3 p-5" role="alert">
        <p className="text-sm text-rose-300">
          Dashboard unavailable. {error ?? "Could not load dashboard data."}
        </p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-zinc-100 hover:bg-white/[0.06]"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-white">Dashboard</h2>
          <p className="text-sm text-zinc-400">A quick look at what Ozymandias is up to.</p>
        </div>
        <label className="inline-flex items-center gap-2 rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 text-xs text-zinc-300">
          <input
            aria-label="dashboard-auto-refresh"
            type="checkbox"
            checked={autoRefresh}
            onChange={(event) => setAutoRefresh(event.target.checked)}
            className="h-3.5 w-3.5 accent-indigo-500"
          />
          Auto-refresh (30s)
        </label>
      </div>

      {error ? (
        <p
          className="rounded-md border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2 text-xs text-amber-200"
          role="status"
          aria-live="polite"
        >
          Latest refresh failed ({error}). Showing the last successful snapshot.
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <KpiTile
          label="System health"
          value={healthLabel}
          hint={systemHealthy ? "All checks passing" : "Some services are degraded"}
          icon={<Activity className="h-4 w-4" aria-hidden="true" />}
          tone={systemHealthy ? "success" : "warning"}
        />
        <KpiTile
          label="Total claims"
          value={stats.claims_total}
          hint="Verified memories in your knowledge base"
          icon={<Brain className="h-4 w-4" aria-hidden="true" />}
          tone="neutral"
        />
        <KpiTile
          label="Pending proposals"
          value={stats.proposals_pending}
          hint={stats.proposals_pending === 0 ? "Nothing waiting for review" : "Waiting for your review"}
          icon={<Sparkles className="h-4 w-4" aria-hidden="true" />}
          tone={stats.proposals_pending > 0 ? "accent" : "neutral"}
        />
      </div>

      <DashboardSection
        title="What Ozy knows"
        description="Memories, workspaces and people, and what is waiting for your decision."
      >
        <ClaimsSummary
          claimsTotal={stats.claims_total}
          verification={stats.claims_by_verification}
          sensitivity={stats.claims_by_sensitivity}
        />
        <ProposalsSummary pending={stats.proposals_pending} total={stats.proposals_total} />
        <ProjectsSummary
          projectsActive={stats.projects_active}
          tasksOpen={stats.projects_tasks_open}
          knowledgeFiles={stats.projects_knowledge_files}
          nextDueTask={stats.projects_next_due_task}
        />
        <ContactsSummary contactsTotal={stats.contacts_total} />
      </DashboardSection>

      <DashboardSection
        title="How Ozy is running"
        description="Services, the limit on how often Ozy may act, and what it costs to run."
      >
        <SystemHealth />
        <CircuitBreakerCard status={stats.circuit_breaker} />
        <ModeSwitch />
        <UsageSummary />
      </DashboardSection>

      <RecentActionsCard entries={stats.recent_actions} />
    </section>
  );
}

export default DashboardView;
