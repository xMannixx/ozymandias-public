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
