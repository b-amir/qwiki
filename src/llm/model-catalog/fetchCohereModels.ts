import { isDeniedGeneralChatModelId } from "@/llm/model-catalog/ChatModelSafetyFilter";
import { fetchJsonWithTimeout } from "@/llm/model-catalog/fetchWithTimeout";

function isCohereChatModelName(name: string): boolean {
  const n = name.toLowerCase();
  if (n.includes("embed")) return false;
  if (n.includes("rerank")) return false;
  if (n.includes("classify")) return false;
  if (n.includes("transcribe")) return false;
  if (!n.startsWith("command") && !n.startsWith("c4ai-")) return false;
  return true;
}

function extractCohereModelNames(data: unknown): string[] {
  const candidates: unknown[] = [];
  if (Array.isArray(data)) {
    for (let i = 0; i < data.length; i++) {
      candidates.push(data[i]);
    }
  } else if (data && typeof data === "object" && "models" in data) {
    const m = (data as { models?: unknown }).models;
    if (Array.isArray(m)) {
      for (let i = 0; i < m.length; i++) {
        candidates.push(m[i]);
      }
    }
  }

  const out: string[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < candidates.length; i++) {
    const row = candidates[i];
    if (!row || typeof row !== "object") continue;
    const name = (row as { name?: string }).name;
    if (typeof name !== "string" || !name.trim()) continue;
    if (seen.has(name)) continue;
    if (!isCohereChatModelName(name)) continue;
    if (isDeniedGeneralChatModelId(name)) continue;
    seen.add(name);
    out.push(name);
  }
  out.sort((a, b) => a.localeCompare(b));
  return out;
}

export async function fetchCohereChatModelIds(apiKey: string): Promise<string[]> {
  const data = await fetchJsonWithTimeout<unknown>("https://api.cohere.com/v1/models", {
    method: "GET",
    headers: { Authorization: `Bearer ${apiKey.trim()}` },
  });
  return extractCohereModelNames(data);
}
