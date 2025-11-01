import type { Command } from "./Command";
import type { EventBus } from "../../events";
import { MessageBusService } from "../services/MessageBusService";

export interface ApplyConfigurationTemplatePayload {
  templateId: string;
}

export class ApplyConfigurationTemplateCommand
  implements Command<ApplyConfigurationTemplatePayload>
{
  constructor(
    private configurationTemplateService: import("../services/ConfigurationTemplateService").ConfigurationTemplateService,
    private messageBus: MessageBusService,
  ) {}

  async execute(payload: ApplyConfigurationTemplatePayload): Promise<void> {
    try {
      await this.configurationTemplateService.applyTemplate(payload.templateId, {});

      this.messageBus.postSuccess("configurationTemplateApplied", {
        templateId: payload.templateId,
      });
    } catch (error) {
      this.messageBus.postError(
        `Failed to apply configuration template: ${error instanceof Error ? error.message : String(error)}`,
        "TEMPLATE_APPLY_ERROR",
      );
    }
  }
}
