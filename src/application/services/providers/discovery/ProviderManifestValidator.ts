import { ValidationResult } from "@/llm/types/ProviderCapabilities";

export class ProviderManifestValidator {
  validateProviderManifest(manifest: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!manifest.id || typeof manifest.id !== "string") {
      errors.push("Provider ID is required and must be a string");
    }

    if (!manifest.name || typeof manifest.name !== "string") {
      errors.push("Provider name is required and must be a string");
    }

    if (!manifest.version || typeof manifest.version !== "string") {
      errors.push("Provider version is required and must be a string");
    }

    if (!manifest.entryPoint || typeof manifest.entryPoint !== "string") {
      errors.push("Provider entry point is required and must be a string");
    }

    if (!manifest.capabilities || typeof manifest.capabilities !== "object") {
      errors.push("Provider capabilities are required and must be an object");
    }

    if (!Array.isArray(manifest.dependencies)) {
      warnings.push("Dependencies should be an array, even if empty");
    }

    if (!manifest.minQwikiVersion || typeof manifest.minQwikiVersion !== "string") {
      warnings.push("Minimum Qwiki version should be specified");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
