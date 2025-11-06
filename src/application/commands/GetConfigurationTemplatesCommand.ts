import type { Command } from "./Command";
import type { MessageBusService } from "../services/MessageBusService";

export class GetConfigurationTemplatesCommand implements Command<void> {
  constructor(
    private configurationTemplateService: import("../services/ConfigurationTemplateService").ConfigurationTemplateService,
    private messageBus: MessageBusService,
  ) {}

  async execute(): Promise<void> {
    try {
      const templates = this.configurationTemplateService.getAvailableTemplates();
      this.messageBus.postSuccess("configurationTemplates", { templates });
    } catch (error) {
      this.messageBus.postError(
        `Failed to get configuration templates: ${error instanceof Error ? error.message : String(error)}`,
        "GET_TEMPLATES_ERROR",
      );
    }
  }
}
