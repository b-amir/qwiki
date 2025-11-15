import type { Webview } from "vscode";
import { CommandRegistry } from "@/application";
import type { LoggingService, Logger } from "@/infrastructure/services";

export class FallbackCommandRegistryFactory {
  constructor(
    private loggingService: LoggingService,
    private logger: Logger,
  ) {}

  createFallbackCommandRegistry(webview: Webview): CommandRegistry {
    this.logger.warn("Creating fallback command registry with limited functionality");

    const fallbackRegistry = new CommandRegistry(this.loggingService);

    const originalExecute = fallbackRegistry.execute.bind(fallbackRegistry);
    const originalRegister = fallbackRegistry.register.bind(fallbackRegistry);

    fallbackRegistry.execute = async <T>(name: string, payload: T): Promise<void> => {
      this.logger.warn(
        `Fallback command registry attempting to execute command "${name}" - initialization may have failed`,
      );
      try {
        return await originalExecute(name, payload);
      } catch (error) {
        this.logger.error(`Fallback command registry command "${name}" failed`, error);
        throw new Error(
          `Command "${name}" cannot be executed due to initialization failure: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    };

    fallbackRegistry.register = <T>(name: string, command: any): void => {
      this.logger.info(`Fallback command registry registered command "${name}"`);
      return originalRegister(name, command);
    };

    return fallbackRegistry;
  }
}
