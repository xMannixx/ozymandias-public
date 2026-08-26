import { useEffect, useState } from "react";
import { listModelsForProvider } from "@/api/llm";

type UseProviderModelsResult = {
  models: string[];
  loading: boolean;
  /** True when the provider offers no list, so the model has to be typed. */
  unavailable: boolean;
};

/**
 * The models one provider currently offers.
 *
 * Providers answer very differently: Ollama reports what is installed,
 * OpenRouter several hundred brokered models, and some clouds nothing at all.
 * Callers only need the three states below.
 */
export function useProviderModels(provider: string | null): UseProviderModelsResult {
  const [models, setModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    if (!provider) {
      setModels([]);
      setUnavailable(false);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setUnavailable(false);
    void (async () => {
      try {
        const items = await listModelsForProvider(provider);
        if (cancelled) {
          return;
        }
        setModels(items);
        setUnavailable(items.length === 0);
      } catch {
        if (cancelled) {
          return;
        }
        setModels([]);
        setUnavailable(true);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [provider]);

  return { models, loading, unavailable };
}
