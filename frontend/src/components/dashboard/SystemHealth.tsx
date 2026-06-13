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

  return (
    <GlassCard className="space-y-2">
      <p className="text-sm font-medium text-gray-200">System Health</p>
      {loading ? <Spinner /> : null}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {health ? (
        <div className="space-y-1 text-sm">
          <p className={statusClass(health.database)}>DB: {health.database}</p>
          <p className={statusClass(health.redis)}>Redis: {health.redis}</p>
          <p className="text-gray-300">Rust: {health.rust_bindings}</p>
          {providers.length > 0 ? (
            providers.map((provider) => {
              const detail = provider.detail ? ` - ${provider.detail}` : "";
              const model = provider.model ? ` (${provider.model})` : "";
              return (
                <p key={provider.name} className={providerStatusClass(provider.status)}>
                  {providerNameLabel(provider.name)}: {providerStatusLabel(provider.status)}
                  {model}
                  {detail}
                </p>
              );
            })
          ) : (
            <p className="text-gray-300">LLM: {health.llm_providers.join(", ") || "keine"}</p>
          )}
          {health.live_web ? (
            <>
              <p className={providerStatusClass(health.live_web.connector_status)}>
                LiveWeb Connector: {providerStatusLabel(health.live_web.connector_status)}
                {health.live_web.connector_detail ? ` - ${health.live_web.connector_detail}` : ""}
              </p>
              <p className="text-gray-300">
                LiveWeb Native: {health.live_web.native_provider_candidates.join(", ") || "keine"}
              </p>
            </>
          ) : null}
        </div>
      ) : null}
    </GlassCard>
  );
}

export default SystemHealth;
