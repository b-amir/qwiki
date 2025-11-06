import type { LLMProvider } from "../../llm/types";
import type { LLMRegistry } from "../../llm";
import type { ConfigurationManagerService } from "../../application/services/ConfigurationManagerService";
import type { ApiKeyRepository } from "../../domain/repositories/ApiKeyRepository";
import type { ProviderId } from "../../llm/types";
import { ErrorCodes, ErrorMessages } from "../../constants/ErrorCodes";
import { ServiceLimits } from "../../constants/ServiceLimits";
import { LoggingService, createLogger, type Logger } from "./LoggingService";
import { createHash } from "crypto";

export interface ValidationResult {
  isValid: boolean;
  errors: Array<{ code: string; message: string; field?: string }>;
  warnings: Array<{ code: string; message: string; field?: string }>;
}

interface CachedValidationResult {
  result: ValidationResult;
  timestamp: number;
}

export class ProviderValidationService {
  private logger: Logger;
  private validationCache = new Map<string, CachedValidationResult>();
  private providersRequiringKeysCache: ProviderId[] | null = null;
  private readonly CACHE_TTL_MS = ServiceLimits.apiKeyValidationCacheTTL;

  constructor(
    private llmRegistry: LLMRegistry,
    private configurationManager: ConfigurationManagerService,
    private apiKeyRepository: ApiKeyRepository,
    private loggingService: LoggingService,
  ) {
    this.logger = createLogger("ProviderValidationService");
  }

  async validateBeforeGeneration(providerId: string, model?: string): Promise<ValidationResult> {
    const errors: Array<{ code: string; message: string; field?: string }> = [];
    const warnings: Array<{ code: string; message: string; field?: string }> = [];

    this.logger.debug("Starting validation before generation", { providerId, model });

    const provider = this.llmRegistry.getProvider(providerId as any);
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

    const settingsValid = await this.validateProviderSettings(providerId);
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
    const errors: Array<{ code: string; message: string; field?: string }> = [];
    const warnings: Array<{ code: string; message: string; field?: string }> = [];

    const provider = this.llmRegistry.getProvider(providerId as any);
    if (!provider) {
      errors.push({
        code: ErrorCodes.missingProvider,
        message: `Provider not found: ${providerId}`,
        field: "providerId",
      });
      return { isValid: false, errors, warnings };
    }

    if (!provider.requiresApiKey) {
      return { isValid: true, errors, warnings };
    }

    const hasSecretKey = await this.apiKeyRepository.has(providerId);
    const providerConfig = await this.configurationManager.getProviderConfig(providerId);
    const hasConfigKey = Boolean(providerConfig?.apiKey);
    const hasApiKey = hasSecretKey || hasConfigKey;

    if (!hasApiKey) {
      errors.push({
        code: ErrorCodes.apiKeyMissing,
        message: `API key is required for provider ${providerId}`,
        field: "apiKey",
      });
      return { isValid: false, errors, warnings };
    }

    let apiKey = await this.apiKeyRepository.get(providerId);
    if (!apiKey && providerConfig?.apiKey) {
      apiKey = providerConfig.apiKey;
    }

    if (!apiKey || apiKey.trim().length === 0) {
      errors.push({
        code: ErrorCodes.apiKeyInvalid,
        message: `API key is empty for provider ${providerId}`,
        field: "apiKey",
      });
      return { isValid: false, errors, warnings };
    }

    const cacheKey = this.getCacheKey(providerId, apiKey);
    const cached = this.validationCache.get(cacheKey);
    if (cached && this.isCacheValid(cached)) {
      return cached.result;
    }

    const configResult = provider.validateConfig({ apiKey });
    const result: ValidationResult = { isValid: true, errors, warnings };

    if (!configResult.isValid) {
      result.isValid = false;
      errors.push({
        code: ErrorCodes.apiKeyInvalid,
        message: `API key format is invalid for provider ${providerId}`,
        field: "apiKey",
      });
    }

    this.validationCache.set(cacheKey, {
      result,
      timestamp: Date.now(),
    });

    return result;
  }

  async validateProviderSettings(providerId: string): Promise<ValidationResult> {
    const errors: Array<{ code: string; message: string; field?: string }> = [];
    const warnings: Array<{ code: string; message: string; field?: string }> = [];

    const provider = this.llmRegistry.getProvider(providerId as any);
    if (!provider) {
      errors.push({
        code: ErrorCodes.missingProvider,
        message: `Provider not found: ${providerId}`,
        field: "providerId",
      });
      return { isValid: false, errors, warnings };
    }

    const providerConfig = await this.configurationManager.getProviderConfig(providerId);
    if (!providerConfig) {
      return { isValid: true, errors, warnings };
    }

    if (providerConfig.enabled === false) {
      warnings.push({
        code: ErrorCodes.providerDisabled,
        message: `Provider ${providerId} is disabled`,
        field: "enabled",
      });
    }

    const customFields = providerConfig.customFields || {};
    const providerUiConfig = provider.getUiConfig?.();
    if (providerUiConfig?.customFields) {
      for (const field of providerUiConfig.customFields) {
        const value = customFields[field.id];
        if (field.defaultValue && !value) {
          warnings.push({
            code: ErrorCodes.customFieldMissing,
            message: `Custom field "${field.label}" has no value`,
            field: field.id,
          });
        }
      }
    }

    return { isValid: true, errors, warnings };
  }

  async getProvidersRequiringApiKey(): Promise<ProviderId[]> {
    if (this.providersRequiringKeysCache !== null) {
      return this.providersRequiringKeysCache;
    }

    const providers = this.llmRegistry.getAllProviders();
    this.providersRequiringKeysCache = Object.keys(providers).filter(
      (id) => providers[id]?.requiresApiKey === true,
    );
    return this.providersRequiringKeysCache;
  }

  async hasAnyApiKey(): Promise<boolean> {
    const providerIds = await this.getProvidersRequiringApiKey();

    if (providerIds.length === 0) {
      return true;
    }

    for (const providerId of providerIds) {
      const hasSecretKey = await this.apiKeyRepository.has(providerId);
      if (hasSecretKey) {
        const apiKey = await this.apiKeyRepository.get(providerId);
        if (apiKey && apiKey.trim().length > 0) {
          return true;
        }
      }

      const providerConfig = await this.configurationManager.getProviderConfig(providerId);
      if (providerConfig?.apiKey && providerConfig.apiKey.trim().length > 0) {
        return true;
      }
    }

    return false;
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
      const providerId = provider.id;
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
    const errors: Array<{ code: string; message: string; field?: string }> = [];
    const warnings: Array<{ code: string; message: string; field?: string }> = [];

    const provider = this.llmRegistry.getProvider(providerId as any);
    if (!provider) {
      errors.push({
        code: ErrorCodes.missingProvider,
        message: `Provider not found: ${providerId}`,
        field: "providerId",
      });
      return { isValid: false, errors, warnings };
    }

    if (!provider.requiresApiKey) {
      return { isValid: true, errors, warnings };
    }

    const trimmedKey = apiKey.trim();
    if (trimmedKey.length === 0) {
      errors.push({
        code: ErrorCodes.apiKeyInvalid,
        message: `API key is empty for provider ${providerId}`,
        field: "apiKey",
      });
      return { isValid: false, errors, warnings };
    }

    const configResult = provider.validateConfig({ apiKey: trimmedKey });
    if (!configResult.isValid) {
      errors.push({
        code: ErrorCodes.apiKeyInvalid,
        message: `API key format is invalid for provider ${providerId}`,
        field: "apiKey",
      });
      return { isValid: false, errors, warnings };
    }

    return { isValid: true, errors, warnings };
  }

  private getCacheKey(providerId: string, apiKey: string): string {
    const apiKeyHash = createHash("sha256").update(apiKey).digest("hex").substring(0, 16);
    return `${providerId}:${apiKeyHash}`;
  }

  private isCacheValid(cached: CachedValidationResult): boolean {
    return Date.now() - cached.timestamp < this.CACHE_TTL_MS;
  }

  invalidateValidationCache(providerId?: string): void {
    if (providerId) {
      const keysToDelete: string[] = [];
      for (const key of this.validationCache.keys()) {
        if (key.startsWith(`${providerId}:`)) {
          keysToDelete.push(key);
        }
      }
      for (const key of keysToDelete) {
        this.validationCache.delete(key);
      }
    } else {
      this.validationCache.clear();
    }
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
