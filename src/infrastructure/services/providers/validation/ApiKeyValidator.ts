import type { LLMProvider } from "@/llm/types";
import type { LLMRegistry } from "@/llm";
import type { ApiKeyRepository } from "@/domain/repositories/ApiKeyRepository";
import { ErrorCodes } from "@/constants/ErrorCodes";
import type { ValidationResult } from "@/infrastructure/services/providers/ProviderValidationService";
import type { ConfigurationManagerService } from "@/application";

export class ApiKeyValidator {
  constructor(
    private llmRegistry: LLMRegistry,
    private apiKeyRepository: ApiKeyRepository,
    private configurationManager: ConfigurationManagerService,
  ) {}

  async validateApiKey(
    providerId: string,
    getCachedResult?: (cacheKey: string) => ValidationResult | null,
    setCachedResult?: (cacheKey: string, result: ValidationResult) => void,
    getCacheKey?: (providerId: string, apiKey: string) => string,
  ): Promise<ValidationResult> {
    const errors: Array<{ code: string; message: string; field?: string }> = [];
    const warnings: Array<{ code: string; message: string; field?: string }> = [];

    const provider = this.llmRegistry.getProvider(providerId);
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

    if (getCachedResult && getCacheKey) {
      const cacheKey = getCacheKey(providerId, apiKey);
      const cached = getCachedResult(cacheKey);
      if (cached) {
        return cached;
      }
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

    if (setCachedResult && getCacheKey) {
      const cacheKey = getCacheKey(providerId, apiKey);
      setCachedResult(cacheKey, result);
    }

    return result;
  }

  async validateApiKeyFormat(providerId: string, apiKey: string): Promise<ValidationResult> {
    const errors: Array<{ code: string; message: string; field?: string }> = [];
    const warnings: Array<{ code: string; message: string; field?: string }> = [];

    const provider = this.llmRegistry.getProvider(providerId);
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

  async hasAnyApiKey(getProvidersRequiringApiKey: () => Promise<string[]>): Promise<boolean> {
    const providerIds = await getProvidersRequiringApiKey();

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
}
