import type { Command } from "./commands/Command";
import { ErrorCodes, ErrorMessages } from "../constants";

export class CommandRegistry {
  private commands = new Map<string, Command>();
  private disposers: Array<() => void> = [];

  register<T>(name: string, command: Command<T>): void {
    this.commands.set(name, command);
  }

  async execute<T>(name: string, payload: T): Promise<void> {
    const command = this.commands.get(name);
    if (!command) {
      throw new Error(`${ErrorMessages[ErrorCodes.missingCommand]}: ${name}`);
    }
    const start = Date.now();
    try {
      console.log(`[QWIKI] CommandRegistry: Executing command "${name}"`);
      await command.execute(payload);
      const duration = Date.now() - start;
      console.log(`[QWIKI] CommandRegistry: Command "${name}" completed in ${duration}ms`);
    } catch (error) {
      const duration = Date.now() - start;
      console.error(
        `[QWIKI] CommandRegistry: Command "${name}" failed after ${duration}ms:`,
        error,
      );
      throw error;
    }
  }

  has(name: string): boolean {
    return this.commands.has(name);
  }

  addDisposer(dispose: () => void): void {
    this.disposers.push(dispose);
  }

  dispose(): void {
    for (const d of this.disposers.splice(0)) {
      try {
        d();
      } catch (err) {
        console.error("[QWIKI] CommandRegistry: Disposer threw:", err);
      }
    }
    this.commands.clear();
  }
}
