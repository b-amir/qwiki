const CHAT_MODEL_DENY_SUBSTRINGS: readonly string[] = [
  "embedding",
  "embed-",
  "-embed",
  "text-embedding",
  "tts",
  "transcribe",
  "audio",
  "veo",
  "imagen",
  "lyria",
  "music",
  "robotics",
  "computer-use",
  "deep-research",
  "nano-banana",
  "rerank",
  "classify",
  "moderation",
  "llama-guard",
  "shield",
  "bge-",
  "e5-",
  "clip",
  "siglip",
  "whisper",
  "speech",
  "live-preview",
  "native-audio",
  "flash-image",
  "pro-image",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
];

const CHAT_MODEL_DENY_PREFIXES: readonly string[] = ["models/"];

export function isDeniedGeneralChatModelId(id: string): boolean {
  const lower = id.toLowerCase();
  for (const sub of CHAT_MODEL_DENY_SUBSTRINGS) {
    if (lower.includes(sub)) {
      return true;
    }
  }
  for (const prefix of CHAT_MODEL_DENY_PREFIXES) {
    if (lower.startsWith(prefix)) {
      return true;
    }
  }
  return false;
}

export function filterOpenRouterFreeChatModels(
  models: ReadonlyArray<{
    id: string;
    pricing?: { prompt?: string; completion?: string };
  }>,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < models.length; i++) {
    const m = models[i];
    if (!m) continue;
    const id = m.id;
    if (!id || seen.has(id)) continue;
    if (!isOpenRouterFreeModel(m)) continue;
    if (isDeniedGeneralChatModelId(id)) continue;
    seen.add(id);
    out.push(id);
  }
  out.sort((a, b) => a.localeCompare(b));
  return out;
}

function isOpenRouterFreeModel(m: {
  id: string;
  pricing?: { prompt?: string; completion?: string };
}): boolean {
  if (m.id.endsWith(":free")) {
    return true;
  }
  const prompt = m.pricing?.prompt;
  const completion = m.pricing?.completion;
  return prompt === "0" && completion === "0";
}

export function filterHuggingFaceHubModels(ids: ReadonlyArray<string>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    if (!id || seen.has(id)) continue;
    if (isDeniedGeneralChatModelId(id)) continue;
    const lower = id.toLowerCase();
    if (lower.includes("gguf")) continue;
    if (
      !(
        lower.includes("instruct") ||
        lower.includes("-chat") ||
        lower.includes("chat-") ||
        lower.includes("/qwen") ||
        lower.includes("/llama") ||
        lower.includes("/mistral") ||
        lower.includes("/gemma") ||
        lower.includes("/phi-")
      )
    ) {
      continue;
    }
    seen.add(id);
    out.push(id);
  }
  out.sort((a, b) => a.localeCompare(b));
  return out;
}
