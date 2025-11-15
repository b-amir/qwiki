import type { Command } from "@/application/commands/Command";
import type { MessageBusService } from "@/application/services/core/MessageBusService";

export class GetConfigurationTemplatesCommand implements Command<void> {
  constructor(
    private configurationTemplateService: import("@/application/services/configuration/ConfigurationTemplateService").ConfigurationTemplateService,
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
