export const ProviderIds = {
  zai: "zai",
  openrouter: "openrouter",
  googleAIStudio: "google-ai-studio",
  cohere: "cohere",
  huggingface: "huggingface",
} as const;

export type ProviderKey = (typeof ProviderIds)[keyof typeof ProviderIds];
