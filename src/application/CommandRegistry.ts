import type { Command } from "./commands/Command";
import { ErrorCodes, ErrorMessages } from "../constants";

export class CommandRegistry {
  private commands = new Map<string, Command>();

  register<T>(name: string, command: Command<T>): void {
    this.commands.set(name, command);
  }

  async execute<T>(name: string, payload: T): Promise<void> {
    const command = this.commands.get(name);
    if (!command) {
      throw new Error(`${ErrorMessages[ErrorCodes.missingCommand]}: ${name}`);
    }
    await command.execute(payload);
  }

  has(name: string): boolean {
    return this.commands.has(name);
  }
}
