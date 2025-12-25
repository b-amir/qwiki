import type { LLMProvider } from "@/llm/types";
import type { LLMRegistry } from "@/llm";
import type { ApiKeyRepository } from "@/domain/repositories/ApiKeyRepository";
import type { ProviderId } from "@/llm/types";
import { ErrorCodes, ErrorMessages } from "@/constants/ErrorCodes";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "@/infrastructure/services/logging/LoggingService";
import { ConfigurationManagerService } from "@/application";
import { ApiKeyValidator } from "@/infrastructure/services/providers/validation/ApiKeyValidator";
import { ProviderSettingsValidator } from "@/infrastructure/services/providers/validation/ProviderSettingsValidator";
import { ValidationCacheManager } from "@/infrastructure/services/providers/validation/ValidationCacheManager";

export interface ValidationResult {
  isValid: boolean;
  errors: Array<{ code: string; message: string; field?: string }>;
  warnings: Array<{ code: string; message: string; field?: string }>;
}

export class ProviderValidationService {
  private logger: Logger;
  private providersRequiringKeysCache: ProviderId[] | null = null;
  private apiKeyValidator: ApiKeyValidator;
  private settingsValidator: ProviderSettingsValidator;
  private cacheManager: ValidationCacheManager;

  constructor(
    private llmRegistry: LLMRegistry,
    private configurationManager: ConfigurationManagerService,
    private apiKeyRepository: ApiKeyRepository,
    private loggingService: LoggingService,
  ) {
    this.logger = createLogger("ProviderValidationService");
    this.cacheManager = new ValidationCacheManager();
    this.apiKeyValidator = new ApiKeyValidator(
      this.llmRegistry,
      this.apiKeyRepository,
      this.configurationManager,
    );
    this.settingsValidator = new ProviderSettingsValidator(
      this.llmRegistry,
      this.configurationManager,
    );
  }

  async validateBeforeGeneration(providerId: string, model?: string): Promise<ValidationResult> {
    const errors: Array<{ code: string; message: string; field?: string }> = [];
    const warnings: Array<{ code: string; message: string; field?: string }> = [];

    this.logger.debug("Starting validation before generation", { providerId, model });

    const provider = this.llmRegistry.getProvider(providerId as ProviderId);
    if (!provider) {
      errors.push({
        code: ErrorCodes.missingProvider,
        message: `Provider not found: ${providerId}`,
        field: "providerId",
      });
      return { isValid: false, errors, warnings };
    }

    const apiKeyValid = await this.validateApiKey(providerId);
    if (!apiKeyValid.isValid) {
      errors.push(...apiKeyValid.errors);
    }
    if (apiKeyValid.warnings.length > 0) {
      warnings.push(...apiKeyValid.warnings);
    }

    const settingsValid = await this.settingsValidator.validateProviderSettings(providerId);
    if (!settingsValid.isValid) {
      errors.push(...settingsValid.errors);
    }
    if (settingsValid.warnings.length > 0) {
      warnings.push(...settingsValid.warnings);
    }

    if (model) {
      const modelValid = await this.validateModel(provider, model);
      if (!modelValid) {
        errors.push({
          code: ErrorCodes.invalidModel,
          message: `Model "${model}" is not available for provider ${providerId}`,
          field: "model",
        });
      }
    }

    const isValid = errors.length === 0;
    this.logger.debug("Validation completed", {
      isValid,
      errorCount: errors.length,
      warningCount: warnings.length,
    });

    return { isValid, errors, warnings };
  }

  async validateApiKey(providerId: string): Promise<ValidationResult> {
    return this.apiKeyValidator.validateApiKey(
      providerId,
      (key) => this.cacheManager.getCachedResult(key),
      (key, result) => this.cacheManager.setCachedResult(key, result),
      (id, key) => this.cacheManager.getCacheKey(id, key),
    );
  }

  async getProvidersRequiringApiKey(): Promise<ProviderId[]> {
    if (this.providersRequiringKeysCache !== null) {
      return this.providersRequiringKeysCache;
    }

    const providers = this.llmRegistry.getAllProviders();
    this.providersRequiringKeysCache = Object.keys(providers).filter(
      (id) => providers[id]?.requiresApiKey === true,
    ) as ProviderId[];
    return this.providersRequiringKeysCache;
  }

  async hasAnyApiKey(): Promise<boolean> {
    return this.apiKeyValidator.hasAnyApiKey(() => this.getProvidersRequiringApiKey());
  }

  async validateAtLeastOneApiKey(): Promise<ValidationResult> {
    const errors: Array<{ code: string; message: string; field?: string }> = [];
    const warnings: Array<{ code: string; message: string; field?: string }> = [];

    const providers = this.llmRegistry.getAllProviders();
    const providersRequiringKeys = Object.values(providers).filter(
      (p) => p.requiresApiKey === true,
    );

    if (providersRequiringKeys.length === 0) {
      return { isValid: true, errors, warnings };
    }

    for (const provider of providersRequiringKeys) {
      const providerId = provider.id as ProviderId;
      const hasSecretKey = await this.apiKeyRepository.has(providerId);

      if (hasSecretKey) {
        const apiKey = await this.apiKeyRepository.get(providerId);
        if (apiKey && apiKey.trim().length > 0) {
          return { isValid: true, errors, warnings };
        }
      }

      const providerConfig = await this.configurationManager.getProviderConfig(providerId);
      if (providerConfig?.apiKey && providerConfig.apiKey.trim().length > 0) {
        return { isValid: true, errors, warnings };
      }
    }

    errors.push({
      code: ErrorCodes.noApiKeysConfigured,
      message: ErrorMessages[ErrorCodes.noApiKeysConfigured],
      field: "apiKey",
    });

    return { isValid: false, errors, warnings };
  }

  async validateApiKeyFormat(providerId: string, apiKey: string): Promise<ValidationResult> {
    return this.apiKeyValidator.validateApiKeyFormat(providerId, apiKey);
  }

  invalidateValidationCache(providerId?: string): void {
    this.cacheManager.invalidateCache(providerId);
    this.invalidateProvidersRequiringKeysCache();
  }

  invalidateProvidersRequiringKeysCache(): void {
    this.providersRequiringKeysCache = null;
  }

  private async validateModel(provider: LLMProvider, model: string): Promise<boolean> {
    const models = provider.listModels();
    return models.includes(model);
  }
}
