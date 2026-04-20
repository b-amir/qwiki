import { isDeniedGeneralChatModelId } from "@/llm/model-catalog/ChatModelSafetyFilter";
import { fetchJsonWithTimeout } from "@/llm/model-catalog/fetchWithTimeout";

function extractZaiModelIds(data: unknown): string[] {
  const rows: unknown[] = [];
  if (Array.isArray(data)) {
    for (let i = 0; i < data.length; i++) {
      rows.push(data[i]);
    }
  } else if (data && typeof data === "object") {
    const d = data as { data?: unknown[]; models?: unknown[] };
    if (Array.isArray(d.data)) {
      for (let i = 0; i < d.data.length; i++) {
        rows.push(d.data[i]);
      }
    } else if (Array.isArray(d.models)) {
      for (let i = 0; i < d.models.length; i++) {
        rows.push(d.models[i]);
      }
    }
  }

  const out: string[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || typeof row !== "object") continue;
    const id =
      typeof (row as { id?: string }).id === "string"
        ? (row as { id: string }).id
        : typeof (row as { name?: string }).name === "string"
          ? (row as { name: string }).name
          : "";
    if (!id || seen.has(id)) continue;
    const lower = id.toLowerCase();
    if (!lower.startsWith("glm-")) continue;
    if (isDeniedGeneralChatModelId(id)) continue;
    seen.add(id);
    out.push(id);
  }
  out.sort((a, b) => a.localeCompare(b));
  return out;
}

export async function fetchZaiChatModelIds(apiKey: string, baseUrl: string): Promise<string[]> {
  const base = baseUrl.replace(/\/$/, "") || "https://api.z.ai/api";
  const url = `${base}/paas/v4/models`;
  const data = await fetchJsonWithTimeout<unknown>(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${apiKey.trim()}` },
  });
  return extractZaiModelIds(data);
}
