import type { ConfigurationTemplate } from "@/domain/configuration";

export function createDevelopmentPreset(): ConfigurationTemplate {
  return {
    id: "development",
    name: "Development Environment",
    description: "Optimized for development with fast feedback and detailed logging",
    category: "development",
    configuration: {
      global: {
        autoGenerateWiki: true,
        wikiOutputFormat: "markdown",
        maxContextLength: 5000,
        enableCaching: true,
        cacheExpirationHours: 1,
        enablePerformanceMonitoring: true,
        enableErrorReporting: true,
        logLevel: "debug",
        uiTheme: "auto",
        language: "en",
        autoSave: true,
        backupEnabled: true,
        backupRetentionDays: 7,
      },
      providers: {
        "google-ai-studio": {
          id: "google-ai-studio",
          name: "Google AI Studio",
          enabled: true,
          model: "gemini-2.5-flash",
          temperature: 0.7,
          maxTokens: 2048,
          rateLimitPerMinute: 30,
          timeout: 10000,
          retryAttempts: 3,
        },
        zai: {
          id: "zai",
          name: "Z.ai",
          enabled: true,
          model: "glm-4.5-flash",
          temperature: 0.5,
          maxTokens: 2048,
          rateLimitPerMinute: 50,
          timeout: 15000,
          retryAttempts: 2,
        },
      },
    },
    metadata: {
      author: "Qwiki",
      version: "1.0.0",
      tags: ["development", "fast", "debugging"],
      compatibleProviders: ["google-ai-studio", "zai", "openrouter", "cohere", "huggingface"],
    },
  };
}
