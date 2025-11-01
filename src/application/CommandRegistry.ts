import type { Command } from "./commands/Command";
import { ErrorCodes, ErrorMessages } from "../constants";
import { LoggingService } from "../infrastructure/services/LoggingService";

export class CommandRegistry {
  private commands = new Map<string, Command>();
  private disposers: Array<() => void> = [];
  private readonly serviceName = "CommandRegistry";

  constructor(
    private loggingService: LoggingService = new LoggingService({
      enabled: false,
      level: "error",
      includeTimestamp: true,
      includeService: true,
    }),
  ) {}

  private logDebug(message: string, data?: unknown): void {
    this.loggingService.debug(this.serviceName, message, data);
  }

  private logError(message: string, data?: unknown): void {
    this.loggingService.error(this.serviceName, message, data);
  }

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
      this.logDebug(`Executing command "${name}"`);
      await command.execute(payload);
      const duration = Date.now() - start;
      this.logDebug(`Command "${name}" completed in ${duration}ms`);
    } catch (error) {
      const duration = Date.now() - start;
      this.logError(`Command "${name}" failed after ${duration}ms`, error);
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
        this.logError("Disposer threw", err);
      }
    }
    this.commands.clear();
  }
}
