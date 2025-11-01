import type { LLMProvider } from "../types";
import { ProviderCapabilities, ProviderFeature } from "../types/ProviderCapabilities";
import { ProviderMetadata } from "../types/ProviderMetadata";
import { ProviderDiscoveryService } from "../../application/services/ProviderDiscoveryService";
import { ProviderLifecycleManagerService } from "../../application/services/ProviderLifecycleManagerService";
import { ProviderDependencyResolverService } from "../../application/services/ProviderDependencyResolverService";
import { EventBus } from "../../events/EventBus";
import { ZAiProvider } from "./zai";
import { OpenRouterProvider } from "./openrouter";
import { GoogleAIStudioProvider } from "./google-ai-studio";
import { CohereProvider } from "./cohere";
import { HuggingFaceProvider } from "./huggingface";
import { CachingService } from "../../infrastructure/services/CachingService";
import { ProviderFileSystemService } from "../../infrastructure/services/ProviderFileSystemService";
import type { GenerateParams, GenerateResult } from "../types";
import { ErrorRecoveryService } from "../../infrastructure/services/ErrorRecoveryService";
import { ProviderError, ErrorCodes } from "../../errors";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "../../infrastructure/services/LoggingService";

export type GetSetting = (key: string) => Promise<any>;

export class LLMRegistry {
  private providers: Record<string, LLMProvider> = {};
  private providerDiscoveryService: ProviderDiscoveryService;
  private providerLifecycleManager: ProviderLifecycleManagerService;
  private providerDependencyResolver: ProviderDependencyResolverService;
  private providerDirectories: string[] = [];
  private cachingService: CachingService;
  private providerFileSystemService: ProviderFileSystemService;
  private loggingService: LoggingService;
  private logger: Logger;

  constructor(
    private eventBus: EventBus,
    loggingService: LoggingService = new LoggingService({
      enabled: false,
      level: "error",
      includeTimestamp: true,
      includeService: true,
    }),
  ) {
    this.loggingService = loggingService;
    this.logger = createLogger("LegacyLLMRegistry", loggingService);
    this.cachingService = new CachingService({ maxSize: 50, defaultTtl: 300000 });
    this.providerFileSystemService = new ProviderFileSystemService();
    this.providerDiscoveryService = new ProviderDiscoveryService(
      this.eventBus,
      this.providerFileSystemService,
      this.loggingService,
    );
    this.providerLifecycleManager = new ProviderLifecycleManagerService(
      this.providerDiscoveryService,
      this.eventBus,
      this.loggingService,
    );
    this.providerDependencyResolver = new ProviderDependencyResolverService();
  }

  private logDebug(message: string, data?: unknown): void {
    this.logger.debug(message, data);
  }

  private logError(message: string, data?: unknown): void {
    this.logger.error(message, data);
  }

  async initialize(): Promise<void> {
    await this.loadBuiltInProviders();
    await this.discoverAndLoadProviders();
  }

  async reloadProviders(): Promise<void> {
    await this.providerLifecycleManager.disposeAllProviders();
    this.providers = {};
    await this.discoverAndLoadProviders();
  }

  async addProviderDirectory(directoryPath: string): Promise<void> {
    this.providerDirectories.push(directoryPath);
    await this.discoverAndLoadProviders();
  }

  async removeProviderDirectory(directoryPath: string): Promise<void> {
    const index = this.providerDirectories.indexOf(directoryPath);
    if (index > -1) {
      this.providerDirectories.splice(index, 1);
    }
    await this.reloadProviders();
  }

  getProviderMetadata(providerId: string): ProviderMetadata | null {
    const discoveredProviders = this.providerDiscoveryService.getDiscoveredProviders();
    return discoveredProviders.find((p) => p.id === providerId) || null;
  }

  getAllProviderCapabilities(): Record<string, ProviderCapabilities> {
    const result: Record<string, ProviderCapabilities> = {};

    for (const [providerId, provider] of Object.entries(this.providers)) {
      result[providerId] = provider.capabilities;
    }

    return result;
  }

  findProvidersWithCapability(capability: ProviderFeature): string[] {
    const result: string[] = [];

    for (const [providerId, provider] of Object.entries(this.providers)) {
      if (provider.supportsCapability(capability)) {
        result.push(providerId);
      }
    }

    return result;
  }

  getProvider(providerId: string): LLMProvider | null {
    return this.providers[providerId] || null;
  }

  getAllProviders(): Record<string, LLMProvider> {
    return { ...this.providers };
  }

  async generate(providerId: string, params: GenerateParams): Promise<GenerateResult> {
    const provider = this.getProvider(providerId);
    if (!provider) {
      throw new Error(`Provider ${providerId} not found`);
    }

    const cacheKey = `provider_${providerId}_${JSON.stringify(params)}`;
    const cachedResult = await this.cachingService.get<GenerateResult>(cacheKey);

    if (cachedResult) {
      return cachedResult;
    }

    const errorRecoveryService = new ErrorRecoveryService(this.eventBus);

    try {
      const result = await errorRecoveryService.executeWithRetry(
        async () => {
          const apiKey = await this.getApiKeyForProvider(providerId);
          return provider.generate(params, apiKey);
        },
        (error: any) => {
          if (error instanceof Error) {
            return new ProviderError(
              ErrorCodes.GENERATION_FAILED,
              error.message,
              providerId,
              error.stack,
            );
          }
          return error;
        },
        providerId,
      );

      await this.cachingService.set(cacheKey, result, { ttl: 300000 });
      return result;
    } catch (error) {
      this.logError(`Provider ${providerId} generation failed after retries:`, error);

      await this.eventBus.publish("providerGenerationFailed", {
        providerId,
        error,
        params,
      });

      throw error;
    }
  }

  private async getApiKeyForProvider(providerId: string): Promise<string | undefined> {
    return undefined;
  }

  private async loadBuiltInProviders(): Promise<void> {
    this.providers["google-ai-studio"] = new GoogleAIStudioProvider(this.getSetting);
    this.providers["zai"] = new ZAiProvider(this.getSetting);
    this.providers["openrouter"] = new OpenRouterProvider();
    this.providers["cohere"] = new CohereProvider();
    this.providers["huggingface"] = new HuggingFaceProvider();
  }

  private async discoverAndLoadProviders(): Promise<void> {
    const discoveredProviders = await this.providerDiscoveryService.discoverProviders();
    const dependencyGraph =
      this.providerDependencyResolver.resolveDependencies(discoveredProviders);

    if (!dependencyGraph.resolved) {
      throw new Error("Provider dependencies could not be resolved");
    }

    const loadOrder = this.providerDependencyResolver.getLoadOrder(discoveredProviders);

    for (const providerId of loadOrder) {
      try {
        await this.providerLifecycleManager.initializeProvider(providerId);
        const provider = this.providerLifecycleManager.getActiveProvider(providerId);
        if (provider) {
          this.providers[providerId] = provider;
        }
      } catch (error) {
        this.logError(`Failed to load provider ${providerId}:`, error);
      }
    }
  }

  private getSetting = (key: string): Promise<any> => {
    return Promise.resolve(null);
  };
}

let registryInstance: LLMRegistry | null = null;

export function getRegistry(eventBus: EventBus): LLMRegistry {
  if (!registryInstance) {
    registryInstance = new LLMRegistry(eventBus);
  }
  return registryInstance;
}

export function loadProviders(getSetting: GetSetting): Record<string, LLMProvider> {
  if (registryInstance) {
    return registryInstance.getAllProviders();
  }

  const legacyProviders: Record<string, LLMProvider> = {};
  legacyProviders["google-ai-studio"] = new GoogleAIStudioProvider(getSetting);
  legacyProviders["zai"] = new ZAiProvider(getSetting);
  legacyProviders["openrouter"] = new OpenRouterProvider();
  legacyProviders["cohere"] = new CohereProvider();
  legacyProviders["huggingface"] = new HuggingFaceProvider();

  return legacyProviders;
}

export function getProviderCapabilities(providerId: string): ProviderCapabilities | null {
  const legacyProviders = loadProviders(() => Promise.resolve(null));
  const provider = legacyProviders[providerId];
  return provider ? provider.capabilities : null;
}

export function getAllProviderCapabilities(): Record<string, ProviderCapabilities> {
  const legacyProviders = loadProviders(() => Promise.resolve(null));
  const result: Record<string, ProviderCapabilities> = {};

  for (const [providerId, provider] of Object.entries(legacyProviders)) {
    result[providerId] = provider.capabilities;
  }

  return result;
}

export function findProvidersWithCapability(capability: ProviderFeature): string[] {
  const legacyProviders = loadProviders(() => Promise.resolve(null));
  const result: string[] = [];

  for (const [providerId, provider] of Object.entries(legacyProviders)) {
    if (provider.supportsCapability(capability)) {
      result.push(providerId);
    }
  }

  return result;
}
