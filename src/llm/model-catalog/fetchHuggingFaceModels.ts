import { filterHuggingFaceHubModels } from "@/llm/model-catalog/ChatModelSafetyFilter";
import { fetchJsonWithTimeout } from "@/llm/model-catalog/fetchWithTimeout";

interface HubModelRow {
  id?: string;
}

export async function fetchHuggingFaceHubChatModelIds(): Promise<string[]> {
  const url =
    "https://huggingface.co/api/models?pipeline_tag=text-generation&sort=trending&limit=80";
  const data = await fetchJsonWithTimeout<HubModelRow[]>(url, { method: "GET" });
  const ids: string[] = [];
  for (let i = 0; i < data.length; i++) {
    const id = data[i]?.id;
    if (typeof id === "string" && id.length > 0) {
      ids.push(id);
    }
  }
  return filterHuggingFaceHubModels(ids);
}
