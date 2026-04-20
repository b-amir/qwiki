import { isDeniedGeneralChatModelId } from "@/llm/model-catalog/ChatModelSafetyFilter";
import { fetchJsonWithTimeout } from "@/llm/model-catalog/fetchWithTimeout";

interface GeminiModelEntry {
  name: string;
  supportedGenerationMethods?: string[];
}

interface GeminiModelsResponse {
  models?: GeminiModelEntry[];
}

export async function fetchGoogleGeminiChatModelIds(apiKey: string): Promise<string[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey.trim())}`;
  const data = await fetchJsonWithTimeout<GeminiModelsResponse>(url, { method: "GET" });
  const models = data.models || [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < models.length; i++) {
    const m = models[i];
    if (!m) continue;
    const methods = m.supportedGenerationMethods;
    if (!methods || !methods.includes("generateContent")) {
      continue;
    }
    const rawName = m.name || "";
    const id = rawName.startsWith("models/") ? rawName.slice("models/".length) : rawName;
    if (!id || seen.has(id)) continue;
    if (isDeniedGeneralChatModelId(id)) continue;
    seen.add(id);
    out.push(id);
  }
  out.sort((a, b) => a.localeCompare(b));
  return out;
}
