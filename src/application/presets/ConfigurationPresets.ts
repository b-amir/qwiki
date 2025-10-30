import type { ConfigurationTemplate } from "../../domain/configuration";

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
          model: "gemini-2.5-pro",
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

export function createEnterprisePreset(): ConfigurationTemplate {
  return {
    id: "enterprise",
    name: "Enterprise Environment",
    description: "Enterprise-grade configuration with security and compliance features",
    category: "enterprise",
    configuration: {
      global: {
        defaultProviderId: "google-ai-studio",
        autoGenerateWiki: false,
        wikiOutputFormat: "markdown",
        maxContextLength: 10000,
        enableCaching: true,
        cacheExpirationHours: 48,
        enablePerformanceMonitoring: true,
        enableErrorReporting: true,
        logLevel: "warn",
        uiTheme: "auto",
        language: "en",
        autoSave: true,
        backupEnabled: true,
        backupRetentionDays: 365,
      },
      providers: {
        "google-ai-studio": {
          id: "google-ai-studio",
          name: "Google AI Studio",
          enabled: true,
          model: "gemini-2.5-pro",
          temperature: 0.1,
          maxTokens: 8192,
          rateLimitPerMinute: 45,
          timeout: 45000,
          retryAttempts: 5,
          fallbackProviderIds: ["zai"],
          customFields: {
            googleAIEndpoint: "native",
          },
        },
        zai: {
          id: "zai",
          name: "Z.ai",
          enabled: true,
          model: "glm-4.6",
          temperature: 0.2,
          maxTokens: 4096,
          rateLimitPerMinute: 80,
          timeout: 30000,
          retryAttempts: 5,
          fallbackProviderIds: ["google-ai-studio"],
          customFields: {
            zaiBaseUrl: "",
          },
        },
        openrouter: {
          id: "openrouter",
          name: "OpenRouter",
          enabled: false,
          model: "openai/gpt-oss-20b",
          temperature: 0.3,
          maxTokens: 4096,
          rateLimitPerMinute: 60,
          timeout: 35000,
          retryAttempts: 4,
        },
      },
    },
    metadata: {
      author: "Qwiki",
      version: "1.0.0",
      tags: ["enterprise", "security", "compliance", "multi-provider"],
      compatibleProviders: ["google-ai-studio", "zai", "openrouter", "cohere", "huggingface"],
    },
  };
}

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
          model: "bigscience/bloomz-7b1",
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
          model: "command-r-08-2024",
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

export function createMultiProviderPreset(): ConfigurationTemplate {
  return {
    id: "multi-provider",
    name: "Multi-Provider Setup",
    description: "Configure multiple providers with intelligent fallback",
    category: "enterprise",
    configuration: {
      global: {
        defaultProviderId: "google-ai-studio",
        autoGenerateWiki: true,
        wikiOutputFormat: "markdown",
        maxContextLength: 6000,
        enableCaching: true,
        cacheExpirationHours: 12,
        enablePerformanceMonitoring: true,
        enableErrorReporting: true,
        logLevel: "info",
        uiTheme: "auto",
        language: "en",
        autoSave: true,
        backupEnabled: true,
        backupRetentionDays: 60,
      },
      providers: {
        "google-ai-studio": {
          id: "google-ai-studio",
          name: "Google AI Studio",
          enabled: true,
          model: "gemini-2.5-pro",
          temperature: 0.2,
          maxTokens: 4096,
          rateLimitPerMinute: 40,
          timeout: 20000,
          retryAttempts: 3,
          fallbackProviderIds: ["zai", "openrouter"],
          customFields: {
            googleAIEndpoint: "openai-compatible",
          },
        },
        zai: {
          id: "zai",
          name: "Z.ai",
          enabled: true,
          model: "glm-4.6",
          temperature: 0.3,
          maxTokens: 3072,
          rateLimitPerMinute: 60,
          timeout: 18000,
          retryAttempts: 2,
          fallbackProviderIds: ["openrouter", "cohere"],
        },
        openrouter: {
          id: "openrouter",
          name: "OpenRouter",
          enabled: true,
          model: "meta-llama/llama-3-8b-instruct",
          temperature: 0.4,
          maxTokens: 2048,
          rateLimitPerMinute: 50,
          timeout: 15000,
          retryAttempts: 2,
          fallbackProviderIds: ["cohere", "huggingface"],
        },
        cohere: {
          id: "cohere",
          name: "Cohere",
          enabled: false,
          model: "command-r-plus-08-2024",
          temperature: 0.3,
          maxTokens: 2048,
          rateLimitPerMinute: 40,
          timeout: 22000,
          retryAttempts: 2,
          fallbackProviderIds: ["huggingface"],
        },
        huggingface: {
          id: "huggingface",
          name: "Hugging Face",
          enabled: false,
          model: "codellama/CodeLlama-7b-Instruct-hf",
          temperature: 0.5,
          maxTokens: 1536,
          rateLimitPerMinute: 25,
          timeout: 25000,
          retryAttempts: 1,
        },
      },
    },
    metadata: {
      author: "Qwiki",
      version: "1.0.0",
      tags: ["multi-provider", "fallback", "resilience", "enterprise"],
      compatibleProviders: ["google-ai-studio", "zai", "openrouter", "cohere", "huggingface"],
    },
  };
}

export function getAllPresets(): ConfigurationTemplate[] {
  return [
    createDevelopmentPreset(),
    createProductionPreset(),
    createEnterprisePreset(),
    createHighPerformancePreset(),
    createCostOptimizedPreset(),
    createMultiProviderPreset(),
  ];
}

export function getPresetById(id: string): ConfigurationTemplate | undefined {
  const presets = getAllPresets();
  return presets.find((preset) => preset.id === id);
}

export function getPresetsByCategory(category: string): ConfigurationTemplate[] {
  const presets = getAllPresets();
  return presets.filter((preset) => preset.category === category);
}

export function getRecommendedPreset(
  usage: "development" | "production" | "enterprise" | "cost-sensitive" | "performance",
): ConfigurationTemplate {
  switch (usage) {
    case "development":
      return createDevelopmentPreset();
    case "production":
      return createProductionPreset();
    case "enterprise":
      return createEnterprisePreset();
    case "cost-sensitive":
      return createCostOptimizedPreset();
    case "performance":
      return createHighPerformancePreset();
    default:
      return createDevelopmentPreset();
  }
}
