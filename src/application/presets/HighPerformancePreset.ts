import type { ConfigurationTemplate } from "@/domain/configuration";

export function createHighPerformancePreset(): ConfigurationTemplate {
  return {
    id: "high-performance",
    name: "High Performance",
    description: "Optimized for maximum speed and throughput",
    category: "production",
    configuration: {
      global: {
        autoGenerateWiki: true,
        wikiOutputFormat: "markdown",
        maxContextLength: 3000,
        enableCaching: true,
        cacheExpirationHours: 6,
        enablePerformanceMonitoring: true,
        enableErrorReporting: false,
        logLevel: "error",
        uiTheme: "auto",
        language: "en",
        autoSave: true,
        backupEnabled: false,
        backupRetentionDays: 1,
      },
      providers: {
        "google-ai-studio": {
          id: "google-ai-studio",
          name: "Google AI Studio",
          enabled: true,
          model: "gemini-2.5-flash",
          temperature: 0.1,
          maxTokens: 1024,
          rateLimitPerMinute: 100,
          timeout: 5000,
          retryAttempts: 1,
        },
        zai: {
          id: "zai",
          name: "Z.ai",
          enabled: true,
          model: "glm-4.5-flash",
          temperature: 0.1,
          maxTokens: 1024,
          rateLimitPerMinute: 200,
          timeout: 5000,
          retryAttempts: 1,
        },
      },
    },
    metadata: {
      author: "Qwiki",
      version: "1.0.0",
      tags: ["performance", "speed", "optimized"],
      compatibleProviders: ["google-ai-studio", "zai"],
    },
  };
}
