import type { ConfigurationTemplate } from "@/domain/configuration";

export function createCostOptimizedPreset(): ConfigurationTemplate {
  return {
    id: "cost-optimized",
    name: "Cost Optimized",
    description: "Minimize costs while maintaining quality",
    category: "production",
    configuration: {
      global: {
        autoGenerateWiki: false,
        wikiOutputFormat: "markdown",
        maxContextLength: 2000,
        enableCaching: true,
        cacheExpirationHours: 72,
        enablePerformanceMonitoring: true,
        enableErrorReporting: true,
        logLevel: "warn",
        uiTheme: "auto",
        language: "en",
        autoSave: true,
        backupEnabled: true,
        backupRetentionDays: 30,
      },
      providers: {
        huggingface: {
          id: "huggingface",
          name: "Hugging Face",
          enabled: true,
          model: "meta-llama/Llama-3.2-3B-Instruct",
          temperature: 0.3,
          maxTokens: 512,
          rateLimitPerMinute: 20,
          timeout: 20000,
          retryAttempts: 2,
        },
        cohere: {
          id: "cohere",
          name: "Cohere",
          enabled: false,
          model: "command-r7b-12-2024",
          temperature: 0.4,
          maxTokens: 768,
          rateLimitPerMinute: 30,
          timeout: 25000,
          retryAttempts: 2,
        },
      },
    },
    metadata: {
      author: "Qwiki",
      version: "1.0.0",
      tags: ["cost", "budget", "economical"],
      compatibleProviders: ["huggingface", "cohere"],
    },
  };
}
