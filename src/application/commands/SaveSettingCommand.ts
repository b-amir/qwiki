import type { Command } from "./Command";
import type { ConfigurationRepository } from "../../domain/repositories/ConfigurationRepository";
import type { MessageBusService } from "../services/MessageBusService";
import { OutboundEvents } from "../../constants/Events";

interface SaveSettingPayload {
  setting: string;
  value: string;
}

export class SaveSettingCommand implements Command<SaveSettingPayload> {
  constructor(
    private configurationRepository: ConfigurationRepository,
    private messageBus: MessageBusService,
  ) {}

  async execute(payload: SaveSettingPayload): Promise<void> {
    await this.configurationRepository.set(payload.setting, payload.value);
    this.messageBus.postSuccess(OutboundEvents.settingSaved, { setting: payload.setting });
  }
}
