import type { LLMRegistry } from "@/llm";
import { ErrorCodes } from "@/constants/ErrorCodes";
import type { ValidationResult } from "@/infrastructure/services/providers/ProviderValidationService";
import type { ConfigurationManagerService } from "@/application";

export class ProviderSettingsValidator {
  constructor(
    private llmRegistry: LLMRegistry,
    private configurationManager: ConfigurationManagerService,
  ) {}

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
}
