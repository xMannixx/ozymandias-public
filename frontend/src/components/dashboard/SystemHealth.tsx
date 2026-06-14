import GlassCard from "@/components/common/GlassCard";
import Spinner from "@/components/common/Spinner";
import { useHealth } from "@/hooks/useHealth";
import type { LLMProviderHealth } from "@/api/types";

function statusClass(value: string): string {
  return value === "ok" ? "text-green-300" : "text-red-300";
}

function providerStatusClass(status: LLMProviderHealth["status"]): string {
  switch (status) {
    case "ok":
      return "text-green-300";
    case "unavailable":
      return "text-red-300";
    case "configured":
      return "text-blue-300";
    case "not_configured":
      return "text-gray-400";
  }
}

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

function SystemHealth(): JSX.Element {
  const { health, loading, error } = useHealth(30000);
  const providers = health?.llm_provider_health ?? [];

  const getStatusLight = (statusValue: string) => {
    if (statusValue === "ok" || statusValue === "dev-fallback") {
      return (
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 shadow-[0_0_8px_#10b981]"></span>
        </span>
      );
    }
    if (statusValue === "configured" || statusValue === "ok") {
      return <span className="h-2.5 w-2.5 rounded-full bg-blue-500 shadow-[0_0_8px_#3b82f6]" />;
    }
    if (statusValue === "not_configured") {
      return <span className="h-2.5 w-2.5 rounded-full bg-slate-600" />;
    }
    return (
      <span className="relative flex h-2.5 w-2.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500 shadow-[0_0_8px_#f43f5e]"></span>
      </span>
    );
  };

  return (
    <GlassCard className="space-y-4 border border-slate-800/80 bg-slate-950/30 backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
        <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold">System-Infrastruktur</p>
        {loading ? (
          <span className="text-[10px] text-blue-400 flex items-center gap-1">
            <Spinner /> Synchronisiere...
          </span>
        ) : (
          <span className="text-[10px] text-gray-500">Live</span>
        )}
      </div>

      {error ? <p className="text-xs text-rose-400 bg-rose-950/20 border border-rose-900/40 p-2 rounded">{error}</p> : null}

      {health ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Database */}
          <div className="bg-slate-900/40 border border-slate-800/40 p-3 rounded-lg flex items-center justify-between hover:bg-slate-900/60 transition-all duration-300">
            <div>
              <p className="text-xs font-semibold text-gray-200">Datenbank</p>
              <p className="text-[10px] text-gray-500">PostgreSQL + Vector</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 capitalize">{health.database}</span>
              {getStatusLight(health.database)}
            </div>
          </div>

          {/* Redis */}
          <div className="bg-slate-900/40 border border-slate-800/40 p-3 rounded-lg flex items-center justify-between hover:bg-slate-900/60 transition-all duration-300">
            <div>
              <p className="text-xs font-semibold text-gray-200">Arbeitsspeicher-Cache</p>
              <p className="text-[10px] text-gray-500">Redis</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 capitalize">{health.redis}</span>
              {getStatusLight(health.redis)}
            </div>
          </div>

          {/* Rust Core */}
          <div className="bg-slate-900/40 border border-slate-800/40 p-3 rounded-lg flex items-center justify-between hover:bg-slate-900/60 transition-all duration-300">
            <div>
              <p className="text-xs font-semibold text-gray-200">Governance Kern</p>
              <p className="text-[10px] text-gray-500">Rust Bindings (PyO3)</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 capitalize">{health.rust_bindings}</span>
              {getStatusLight(health.rust_bindings)}
            </div>
          </div>

          {/* Local LLM (Ollama / LM Studio) */}
          {providers.map((provider) => {
            const modelLabel = provider.model ? ` (${provider.model})` : "";
            return (
              <div key={provider.name} className="bg-slate-900/40 border border-slate-800/40 p-3 rounded-lg flex items-center justify-between hover:bg-slate-900/60 transition-all duration-300 col-span-1 sm:col-span-2">
                <div>
                  <p className="text-xs font-semibold text-gray-200">
                    {providerNameLabel(provider.name)} {modelLabel}
                  </p>
                  <p className="text-[10px] text-gray-500 max-w-[280px] truncate">
                    {provider.detail || (provider.status === "ok" ? "Verbindung hergestellt" : "Nicht verbunden")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 capitalize">{providerStatusLabel(provider.status)}</span>
                  {getStatusLight(provider.status)}
                </div>
              </div>
            );
          })}

          {/* LiveWeb */}
          {health.live_web ? (
            <div className="bg-slate-900/40 border border-slate-800/40 p-3 rounded-lg flex items-center justify-between hover:bg-slate-900/60 transition-all duration-300 col-span-1 sm:col-span-2">
              <div>
                <p className="text-xs font-semibold text-gray-200">Live-Web Connector</p>
                <p className="text-[10px] text-gray-500 max-w-[280px] truncate">
                  {health.live_web.connector_detail || "Suchmodul bereit"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 capitalize">{providerStatusLabel(health.live_web.connector_status)}</span>
                {getStatusLight(health.live_web.connector_status)}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </GlassCard>
  );
}

export default SystemHealth;
