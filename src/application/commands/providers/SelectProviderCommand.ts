import { window, QuickPickItem } from "vscode";
import type { LLMRegistry } from "@/llm";
import type { ApiKeyRepository } from "@/domain/repositories/ApiKeyRepository";
import type { ConfigurationManagerService } from "@/application/services/configuration/ConfigurationManagerService";
import { LoggingService, createLogger, type Logger } from "@/infrastructure/services";

interface ProviderQuickPickItem extends QuickPickItem {
  providerId: string;
}

export class SelectProviderCommand {
  private logger: Logger;

  constructor(
    private llmRegistry: LLMRegistry,
    private apiKeyRepository: ApiKeyRepository,
    private configurationManager: ConfigurationManagerService,
    private loggingService: LoggingService,
  ) {
    this.logger = createLogger("SelectProviderCommand");
  }

  async execute(): Promise<string | undefined> {
    try {
      const providers = this.llmRegistry.list();
      this.logger.debug(`Found ${providers.length} providers for selection`);

      const items: ProviderQuickPickItem[] = await Promise.all(
        providers.map(async (p) => {
          const hasSecretKey = await this.apiKeyRepository.has(p.id);
          const providerConfig = await this.configurationManager.getProviderConfig(p.id);
          const hasConfigKey = Boolean(providerConfig?.apiKey);
          const hasKey = hasSecretKey || hasConfigKey;
          const models = p.models || [];

          return {
            label: p.name,
            description: hasKey ? "✓ Configured" : "Not configured",
            detail:
              models.length > 0
                ? `Models: ${models.slice(0, 3).join(", ")}${models.length > 3 ? "..." : ""}`
                : "No models available",
            providerId: p.id,
          };
        }),
      );

      const selected = await window.showQuickPick(items, {
        placeHolder: "Select LLM Provider",
        matchOnDescription: true,
        matchOnDetail: true,
      });

      if (selected) {
        this.logger.info(`Provider selected: ${selected.providerId}`);
        return selected.providerId;
      }

      return undefined;
    } catch (error) {
      this.logger.error("Failed to select provider", error);
      window.showErrorMessage(
        `Failed to select provider: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      throw error;
    }
  }
}
