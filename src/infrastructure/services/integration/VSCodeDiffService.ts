import { commands, Uri } from "vscode";
import { VSCodeCommands } from "@/constants";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "@/infrastructure/services/logging/LoggingService";

export class VSCodeDiffService {
  private logger: Logger;

  constructor(private loggingService: LoggingService) {
    this.logger = createLogger("VSCodeDiffService");
  }

  async showDiff(originalPath: string, updatedPath: string, title: string): Promise<void> {
    try {
      const originalUri = Uri.file(originalPath);
      const updatedUri = Uri.file(updatedPath);
      await commands.executeCommand(VSCodeCommands.diff, originalUri, updatedUri, title);
    } catch (error) {
      this.logger.error("Failed to open diff view", {
        originalPath,
        updatedPath,
        title,
        error,
      });
      throw error instanceof Error ? error : new Error(String(error));
    }
  }
}
