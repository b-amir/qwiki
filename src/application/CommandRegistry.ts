import type { Command } from "@/application/commands/Command";
import { ErrorCodes, ErrorMessages } from "@/constants";
import { COMMAND_TIMEOUTS, IMMEDIATE_COMMANDS } from "@/constants/ServiceTiers";
import {
  LoggingService,
  createLogger,
  type Logger,
  type ServiceReadinessManager,
} from "@/infrastructure/services";

export type CommandGroup =
  | "core"
  | "providers"
  | "configuration"
  | "wikis"
  | "readme"
  | "utilities";

export interface CommandMetadata {
  id: string;
  group: CommandGroup;
  requiresReadiness?: string[];
  timeout?: number;
  description?: string;
}

const DEFAULT_COMMAND_TIMEOUT = 10000;

export class CommandRegistry {
  private commands = new Map<string, Command>();
  private metadata = new Map<string, CommandMetadata>();
  private disposers: Array<() => void> = [];
  private logger: Logger;

  constructor(
    private loggingService: LoggingService = new LoggingService(),
    private readinessManager?: ServiceReadinessManager,
  ) {
    this.logger = createLogger("CommandRegistry");
  }

  private logDebug(message: string, data?: unknown): void {
    this.logger.debug(message, data);
  }

  private logError(message: string, data?: unknown): void {
    this.logger.error(message, data);
  }

  register<T>(name: string, command: Command<T>, metadata?: CommandMetadata): void {
    this.commands.set(name, command);

    if (metadata) {
      this.metadata.set(name, metadata);
    }
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

    const metadata = this.metadata.get(name);

    if (IMMEDIATE_COMMANDS.has(name)) {
      await this.executeCommand(command, payload);
      return;
    }

    if (metadata?.requiresReadiness && this.readinessManager) {
      await this.validateReadiness(name, metadata.requiresReadiness);
    }

    const timeout =
      metadata?.timeout ||
      COMMAND_TIMEOUTS[name] ||
      COMMAND_TIMEOUTS.default ||
      DEFAULT_COMMAND_TIMEOUT;
    await this.executeWithTimeout(name, command, payload, timeout, startTime);
  }

  private async validateReadiness(commandId: string, requiredServices: string[]): Promise<void> {
    if (!this.readinessManager) {
      return;
    }

    const canExecute = this.readinessManager.canExecuteCommand(commandId);
    if (canExecute) {
      return;
    }

    const missingServices: string[] = [];
    for (const serviceId of requiredServices) {
      if (!this.readinessManager.isReady(serviceId)) {
        missingServices.push(serviceId);
      }
    }

    if (missingServices.length > 0) {
      const requirements = this.readinessManager.getRequiredServices(commandId);
      const waitTimeout =
        COMMAND_TIMEOUTS[commandId] || COMMAND_TIMEOUTS.default || DEFAULT_COMMAND_TIMEOUT;

      this.logger.debug("Waiting for required services", {
        command: commandId,
        missingServices,
        waitTimeout,
      });

      const waitPromises = missingServices.map((serviceId) =>
        this.readinessManager!.waitForService(serviceId, waitTimeout),
      );

      const results = await Promise.all(waitPromises);
      const allReady = results.every((ready) => ready);

      if (!allReady) {
        const stillMissing = missingServices.filter((serviceId, index) => !results[index]);
        throw new Error(
          `Command ${commandId} requires services that are not ready: ${stillMissing.join(", ")}`,
        );
      }
    }
  }

  private async executeWithTimeout<T>(
    name: string,
    command: Command<T>,
    payload: T,
    timeout: number,
    startTime: number,
  ): Promise<void> {
    const hasPayload =
      !!payload && (typeof payload === "object" ? Object.keys(payload).length > 0 : true);
    const importantCommands = new Set(["generateWiki", "saveWiki", "cancelWikiGeneration"]);

    if (importantCommands.has(name)) {
      this.logger.debug("Executing command", {
        command: name,
        hasPayload,
        timeout,
      });
    }

    try {
      const executionPromise = command.execute(payload);

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Command ${name} timed out after ${timeout}ms`));
        }, timeout);
      });

      await Promise.race([executionPromise, timeoutPromise]);

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

  private async executeCommand<T>(command: Command<T>, payload: T): Promise<void> {
    await command.execute(payload);
  }

  has(name: string): boolean {
    return this.commands.has(name);
  }

  getMetadata(name: string): CommandMetadata | undefined {
    return this.metadata.get(name);
  }

  getCommandsByGroup(group: CommandGroup): CommandMetadata[] {
    return Array.from(this.metadata.values()).filter((meta) => meta.group === group);
  }

  getAllCommands(): CommandMetadata[] {
    return Array.from(this.metadata.values());
  }

  getCommandGroup(commandId: string): CommandGroup | undefined {
    return this.metadata.get(commandId)?.group;
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
    this.metadata.clear();
  }
}
