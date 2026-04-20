import type { ConfigurationTemplate } from "@/domain/configuration";

export function createProductionPreset(): ConfigurationTemplate {
  return {
    id: "production",
    name: "Production Environment",
    description: "Optimized for production with stability and performance focus",
    category: "production",
    configuration: {
      global: {
        autoGenerateWiki: false,
        wikiOutputFormat: "markdown",
        maxContextLength: 8000,
        enableCaching: true,
        cacheExpirationHours: 24,
        enablePerformanceMonitoring: true,
        enableErrorReporting: true,
        logLevel: "error",
        uiTheme: "auto",
        language: "en",
        autoSave: true,
        backupEnabled: true,
        backupRetentionDays: 90,
      },
      providers: {
        "google-ai-studio": {
          id: "google-ai-studio",
          name: "Google AI Studio",
          enabled: true,
          model: "gemini-2.5-flash",
          temperature: 0.2,
          maxTokens: 4096,
          rateLimitPerMinute: 60,
          timeout: 30000,
          retryAttempts: 5,
          fallbackProviderIds: ["zai", "openrouter"],
        },
        zai: {
          id: "zai",
          name: "Z.ai",
          enabled: false,
          model: "glm-4.6",
          temperature: 0.3,
          maxTokens: 4096,
          rateLimitPerMinute: 100,
          timeout: 25000,
          retryAttempts: 3,
          fallbackProviderIds: ["google-ai-studio", "openrouter"],
        },
      },
    },
    metadata: {
      author: "Qwiki",
      version: "1.0.0",
      tags: ["production", "stable", "performance"],
      compatibleProviders: ["google-ai-studio", "zai", "openrouter", "cohere", "huggingface"],
    },
  };
}
