import { filterOpenRouterFreeChatModels } from "@/llm/model-catalog/ChatModelSafetyFilter";
import { fetchJsonWithTimeout } from "@/llm/model-catalog/fetchWithTimeout";

interface OpenRouterModelsResponse {
  data?: Array<{ id: string; pricing?: { prompt?: string; completion?: string } }>;
}

export async function fetchOpenRouterFreeChatModelIds(apiKey?: string): Promise<string[]> {
  const headers: Record<string, string> = {};
  if (apiKey?.trim()) {
    headers.Authorization = `Bearer ${apiKey.trim()}`;
  }
  const data = await fetchJsonWithTimeout<OpenRouterModelsResponse>(
    "https://openrouter.ai/api/v1/models",
    { method: "GET", headers },
  );
  const rows = data.data || [];
  return filterOpenRouterFreeChatModels(rows);
}
