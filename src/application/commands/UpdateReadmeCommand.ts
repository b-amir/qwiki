import type { Command } from "./Command";
import type { ReadmeUpdateService, ReadmeUpdateConfig } from "../services/ReadmeUpdateService";
import type { MessageBusService } from "../services/MessageBusService";
import type { ConfigurationManagerService } from "../services/ConfigurationManagerService";
import type { ProviderId } from "../../llm/types";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "../../infrastructure/services/LoggingService";

interface UpdateReadmePayload {
  wikiIds: string[];
  config?: Partial<ReadmeUpdateConfig>;
}

export class UpdateReadmeCommand implements Command<UpdateReadmePayload> {
  private logger: Logger;

  constructor(
    private readmeUpdateService: ReadmeUpdateService,
    private messageBus: MessageBusService,
    private configurationManager: ConfigurationManagerService,
    private loggingService: LoggingService = new LoggingService(),
  ) {
    this.logger = createLogger("UpdateReadmeCommand");
  }

  private logDebug(message: string, data?: unknown): void {
    this.logger.debug(message, data);
  }

  private logError(message: string, data?: unknown): void {
    this.logger.error(message, data);
  }

  async execute(payload: UpdateReadmePayload): Promise<void> {
    try {
      this.logDebug("Updating README", { wikiCount: payload.wikiIds.length });

      if (!payload.wikiIds || payload.wikiIds.length === 0) {
        throw new Error("At least one wiki ID is required");
      }

      const globalConfig = await this.configurationManager.getGlobalConfig();
      const defaultProviderId =
        globalConfig.defaultProviderId || ("google-ai-studio" as ProviderId);

      let providerId = payload.config?.providerId || defaultProviderId;
      if (!providerId) {
        throw new Error("Provider ID is required. Please configure a default provider.");
      }

      const providerConfig = await this.configurationManager.getProviderConfig(providerId);
      const model = payload.config?.model || providerConfig?.model;

      const config: ReadmeUpdateConfig = {
        providerId: providerId as ProviderId,
        model,
        backupOriginal: payload.config?.backupOriginal ?? true,
      };

      const result = await this.readmeUpdateService.updateReadmeFromWikis(payload.wikiIds, config);

      if (result.requiresApproval) {
        this.logDebug("README update requires user approval");
        return;
      }

      if (result.success) {
        await this.messageBus.postMessage("readmeUpdated", {
          result,
          success: true,
        });

        await this.messageBus.postMessage("showNotification", {
          type: "success",
          message: "README updated successfully",
        });
      } else {
        await this.messageBus.postMessage("readmeUpdateFailed", {
          result,
          success: false,
        });

        await this.messageBus.postMessage("showNotification", {
          type: "error",
          message: `Failed to update README: ${result.conflicts.join(", ")}`,
        });
      }

      this.logDebug("README update completed", { success: result.success });
    } catch (error) {
      this.logError("Failed to update README", error);
      await this.messageBus.postMessage("showNotification", {
        type: "error",
        message: `Failed to update README: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
      throw error;
    }
  }
}
