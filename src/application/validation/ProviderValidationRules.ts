import type { ValidationRule } from "@/application/services/configuration/ConfigurationValidationEngineService";
import { createGoogleAIStudioValidationRules as createGoogleRules } from "@/application/validation/rules/GoogleAIStudioValidationRules";
import { createZAIValidationRules as createZAIRules } from "@/application/validation/rules/ZAIValidationRules";
import { createOpenRouterValidationRules as createOpenRouterRules } from "@/application/validation/rules/OpenRouterValidationRules";
import { createCohereValidationRules as createCohereRules } from "@/application/validation/rules/CohereValidationRules";
import { createHuggingFaceValidationRules as createHuggingFaceRules } from "@/application/validation/rules/HuggingFaceValidationRules";
import { createCommonValidationRules as createCommonRules } from "@/application/validation/rules/CommonValidationRules";
import { createCustomValidationRules as createCustomRules } from "@/application/validation/rules/CustomValidationRules";

export function createGoogleAIStudioValidationRules(): ValidationRule[] {
  return createGoogleRules();
}

export function createZAIValidationRules(): ValidationRule[] {
  return createZAIRules();
}

export function createOpenRouterValidationRules(): ValidationRule[] {
  return createOpenRouterRules();
}

export function createCohereValidationRules(): ValidationRule[] {
  return createCohereRules();
}

export function createHuggingFaceValidationRules(): ValidationRule[] {
  return createHuggingFaceRules();
}

export function createCustomValidationRules(): ValidationRule[] {
  return createCustomRules();
}

export function createCommonValidationRules(): ValidationRule[] {
  return createCommonRules();
}
