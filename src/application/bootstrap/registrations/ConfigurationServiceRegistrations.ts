import { Container } from "@/container/Container";
import type { ExtensionContext } from "vscode";
import { LoggingService } from "@/infrastructure/services";
import { ConfigurationManagerService } from "@/application/services/configuration/ConfigurationManagerService";
import { ConfigurationValidationEngineService } from "@/application/services/configuration/ConfigurationValidationEngineService";
import { ConfigurationImportExportService } from "@/application/services/configuration/ConfigurationImportExportService";
import { ConfigurationMigrationService } from "@/application/services/configuration/ConfigurationMigrationService";
import { ConfigurationTemplateService } from "@/application/services/configuration/ConfigurationTemplateService";
import { ConfigurationBackupService } from "@/infrastructure/services/storage/ConfigurationBackupService";
import {
  createGoogleAIStudioValidationRules,
  createZAIValidationRules,
  createOpenRouterValidationRules,
  createCohereValidationRules,
  createHuggingFaceValidationRules,
  createCommonValidationRules,
} from "../../validation/ProviderValidationRules";

export function registerConfigurationServices(
  container: Container,
  context: ExtensionContext,
  loggingService: LoggingService,
): void {
  container.register("configurationValidationEngine", () => {
    const engine = new ConfigurationValidationEngineService();
    initializeValidationRules(engine);
    return engine;
  });

  container.register("configurationValidator", () =>
    container.resolve("configurationValidationEngine"),
  );

  container.register(
    "configurationImportExportService",
    () => new ConfigurationImportExportService(container.resolve("configurationValidationEngine")),
  );

  container.register(
    "configurationMigrationService",
    () =>
      new ConfigurationMigrationService(
        container.resolve("configurationRepository"),
        container.resolve("eventBus"),
      ),
  );

  container.register(
    "configurationTemplateService",
    () => new ConfigurationTemplateService(container.resolve("configurationValidationEngine")),
  );

  container.register(
    "configurationBackupService",
    () =>
      new ConfigurationBackupService(
        container.resolve("configurationRepository"),
        container.resolve("eventBus"),
      ),
  );

  container.register(
    "configurationManager",
    () =>
      new ConfigurationManagerService(
        container.resolve("configurationRepository"),
        container.resolve("eventBus"),
        container.resolve("configurationValidationEngine"),
        container.resolve("configurationTemplateService"),
        container.resolve("configurationImportExportService"),
        context,
        loggingService,
      ),
  );
}

function initializeValidationRules(engine: ConfigurationValidationEngineService): void {
  engine.addProviderValidationRules("google-ai-studio", createGoogleAIStudioValidationRules());
  engine.addProviderValidationRules("zai", createZAIValidationRules());
  engine.addProviderValidationRules("openrouter", createOpenRouterValidationRules());
  engine.addProviderValidationRules("cohere", createCohereValidationRules());
  engine.addProviderValidationRules("huggingface", createHuggingFaceValidationRules());

  const commonRules = createCommonValidationRules();
  for (const rule of commonRules) {
    engine.addValidationRule(rule);
  }
}
