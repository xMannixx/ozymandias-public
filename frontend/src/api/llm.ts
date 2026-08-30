import { request } from "@/api/client";
import type { LLMProviderInfo } from "@/api/types";

export function listProviders(): Promise<LLMProviderInfo[]> {
  return request<LLMProviderInfo[]>("/llm/providers");
}

export function listOllamaModels(): Promise<string[]> {
  return request<string[]>("/llm/ollama/models");
}

export function listLMStudioModels(): Promise<string[]> {
  return request<string[]>("/llm/lmstudio/models");
}

export function listDeepSeekModels(): Promise<string[]> {
  return request<string[]>("/llm/deepseek/models");
}

export function listMistralModels(): Promise<string[]> {
  return request<string[]>("/llm/mistral/models");
}

export function listOpenAIModels(): Promise<string[]> {
  return request<string[]>("/llm/openai/models");
}

export function listGeminiModels(): Promise<string[]> {
  return request<string[]>("/llm/gemini/models");
}

/** Several hundred entries, read live from OpenRouter's catalogue. */
export function listOpenRouterModels(): Promise<string[]> {
  return request<string[]>("/llm/openrouter/models");
}

export function listModelsForProvider(provider: string): Promise<string[]> {
  switch (provider) {
    case "ollama":
      return listOllamaModels();
    case "lmstudio":
      return listLMStudioModels();
    case "deepseek":
      return listDeepSeekModels();
    case "mistral":
      return listMistralModels();
    case "openai":
      return listOpenAIModels();
    case "gemini":
      return listGeminiModels();
    case "openrouter":
      return listOpenRouterModels();
    default:
      // Providers without a catalogue, such as Anthropic: the caller then
      // offers a free-text field instead of a dropdown.
      return Promise.resolve([]);
  }
}
