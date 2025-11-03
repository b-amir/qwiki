import type { Command } from "./commands/Command";
import { ErrorCodes, ErrorMessages } from "../constants";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "../infrastructure/services/LoggingService";

export class CommandRegistry {
  private commands = new Map<string, Command>();
  private disposers: Array<() => void> = [];
  private logger: Logger;

  constructor(
    private loggingService: LoggingService = new LoggingService({
      enabled: false,
      level: "error",
      includeTimestamp: true,
      includeService: true,
    }),
  ) {
    this.logger = createLogger("CommandRegistry", loggingService);
  }

  private logDebug(message: string, data?: unknown): void {
    this.logger.debug(message, data);
  }

  private logError(message: string, data?: unknown): void {
    this.logger.error(message, data);
  }

  register<T>(name: string, command: Command<T>): void {
    this.commands.set(name, command);
  }

  async execute<T>(name: string, payload: T): Promise<void> {
    const startTime = Date.now();
    const command = this.commands.get(name);

    if (!command) {
      this.logger.error("Command not found in registry", {
        command: name,
        availableCommands: Array.from(this.commands.keys()),
      });
      throw new Error(`${ErrorMessages[ErrorCodes.missingCommand]}: ${name}`);
    }

    const hasPayload =
      !!payload && (typeof payload === "object" ? Object.keys(payload).length > 0 : true);
    const importantCommands = new Set(["generateWiki", "saveWiki", "cancelWikiGeneration"]);

    if (importantCommands.has(name)) {
      this.logger.debug("Executing command", {
        command: name,
        hasPayload,
      });
    }

    try {
      await command.execute(payload);
      const duration = Date.now() - startTime;

      if (importantCommands.has(name) || duration > 500) {
        this.logger.debug("Command completed", {
          command: name,
          duration,
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error("Command execution failed", {
        command: name,
        duration,
        error,
      });
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
