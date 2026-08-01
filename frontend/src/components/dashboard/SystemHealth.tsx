import GlassCard from "@/components/common/GlassCard";
import Spinner from "@/components/common/Spinner";
import { useHealth } from "@/hooks/useHealth";
import type { LLMProviderHealth } from "@/api/types";

function providerStatusLabel(status: LLMProviderHealth["status"]): string {
  switch (status) {
    case "ok":
      return "ok";
    case "unavailable":
      return "unavailable";
    case "configured":
      return "configured";
    case "not_configured":
      return "not configured";
  }
}

function providerNameLabel(providerName: string): string {
  if (providerName === "openai") {
    return "OpenAI";
  }
  if (providerName === "lmstudio") {
    return "LM Studio";
  }
  return providerName[0].toUpperCase() + providerName.slice(1);
}

function statusDot(status: string): JSX.Element {
  let cls = "bg-zinc-500";
  if (status === "ok" || status === "dev-fallback") {
    cls = "bg-emerald-400";
  } else if (status === "configured") {
    cls = "bg-sky-400";
  } else if (status === "not_configured") {
    cls = "bg-zinc-600";
  } else {
    cls = "bg-rose-400";
  }
  return <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${cls}`} />;
}

type Row = {
  key: string;
  title: string;
  subtitle: string;
  status: string;
  statusLabel: string;
};

function ServiceRow({ row }: { row: Row }): JSX.Element {
  return (
    <div className="flex items-center justify-between rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-zinc-200">{row.title}</p>
        <p className="truncate text-[11px] text-zinc-500">{row.subtitle}</p>
      </div>
      <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
        <span className="capitalize">{row.statusLabel}</span>
        {statusDot(row.status)}
      </div>
    </div>
  );
}

function SystemHealth(): JSX.Element {
  const { health, loading, error } = useHealth(30000);
  const providers = health?.llm_provider_health ?? [];

  return (
    <GlassCard className="space-y-3">
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          System infrastructure
        </p>
        {loading ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-zinc-400">
            <Spinner /> Syncing…
          </span>
        ) : (
          <span className="text-[11px] text-zinc-500">Live</span>
        )}
      </div>

      {error ? (
        <p
          className="rounded-md border border-rose-500/20 bg-rose-500/[0.06] px-2 py-1.5 text-xs text-rose-200"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {health ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <ServiceRow
            row={{
              key: "db",
              title: "Database",
              subtitle: "PostgreSQL + vector",
              status: health.database,
              statusLabel: health.database,
            }}
          />
          <ServiceRow
            row={{
              key: "redis",
              title: "In-memory cache",
              subtitle: "Redis",
              status: health.redis,
              statusLabel: health.redis,
            }}
          />
          <ServiceRow
            row={{
              key: "rust",
              title: "Governance core",
              subtitle: "Rust bindings (PyO3)",
              status: health.rust_bindings,
              statusLabel: health.rust_bindings,
            }}
          />
          {providers.map((provider) => (
            <ServiceRow
              key={provider.name}
              row={{
                key: provider.name,
                title: `${providerNameLabel(provider.name)}${provider.model ? ` · ${provider.model}` : ""}`,
                subtitle: provider.detail || (provider.status === "ok" ? "Connected" : "Not connected"),
                status: provider.status,
                statusLabel: providerStatusLabel(provider.status),
              }}
            />
          ))}
          {health.live_web ? (
            <div className="sm:col-span-2">
              <ServiceRow
                row={{
                  key: "live_web",
                  title: "Live-web connector",
                  subtitle: health.live_web.connector_detail || "Search module ready",
                  status: health.live_web.connector_status,
                  statusLabel: providerStatusLabel(health.live_web.connector_status),
                }}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </GlassCard>
  );
}

export default SystemHealth;
