import type { LLMProvider } from "../../llm/types";
import type { LLMRegistry } from "../../llm";
import type { ConfigurationManagerService } from "../../application/services/ConfigurationManagerService";
import type { ApiKeyRepository } from "../../domain/repositories/ApiKeyRepository";
import { ErrorCodes } from "../../constants/ErrorCodes";
import { LoggingService, createLogger, type Logger } from "./LoggingService";

export interface ValidationResult {
  isValid: boolean;
  errors: Array<{ code: string; message: string; field?: string }>;
  warnings: Array<{ code: string; message: string; field?: string }>;
}

export class ProviderValidationService {
  private logger: Logger;

  constructor(
    private llmRegistry: LLMRegistry,
    private configurationManager: ConfigurationManagerService,
    private apiKeyRepository: ApiKeyRepository,
    private loggingService: LoggingService,
  ) {
    this.logger = createLogger("ProviderValidationService", loggingService);
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

    const hasApiKey = await this.apiKeyRepository.has(providerId);
    if (!hasApiKey) {
      errors.push({
        code: ErrorCodes.apiKeyMissing,
        message: `API key is required for provider ${providerId}`,
        field: "apiKey",
      });
      return { isValid: false, errors, warnings };
    }

    const apiKey = await this.apiKeyRepository.get(providerId);
    if (!apiKey || apiKey.trim().length === 0) {
      errors.push({
        code: ErrorCodes.apiKeyInvalid,
        message: `API key is empty for provider ${providerId}`,
        field: "apiKey",
      });
      return { isValid: false, errors, warnings };
    }

    const configResult = provider.validateConfig({ apiKey });
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

  private async validateModel(provider: LLMProvider, model: string): Promise<boolean> {
    const models = provider.listModels();
    return models.includes(model);
  }
}
