import * as vscode from "vscode";
import { LoggingService, createLogger } from "@/infrastructure/services";

export interface ProgressOptions {
  title: string;
  location?: vscode.ProgressLocation;
  cancellable?: boolean;
}

export class ProgressService {
  private logger = createLogger("ProgressService");

  constructor(private loggingService: LoggingService) {}

  async withProgress<T>(
    options: ProgressOptions,
    task: (
      progress: vscode.Progress<{ message?: string; increment?: number }>,
      token: vscode.CancellationToken,
    ) => Promise<T>,
  ): Promise<T> {
    const { title, location = vscode.ProgressLocation.Notification, cancellable = false } = options;

    this.logger.debug("Starting progress operation", { title, location, cancellable });

    return vscode.window.withProgress(
      {
        location,
        title,
        cancellable,
      },
      async (progress, token) => {
        try {
          const result = await task(progress, token);
          this.logger.debug("Progress operation completed", { title });
          return result;
        } catch (error) {
          this.logger.error("Progress operation failed", { title, error });
          throw error;
        }
      },
    );
  }

  showStatusBar(message: string, command?: string): vscode.StatusBarItem {
    const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    item.text = message;
    if (command) {
      item.command = command;
    }
    item.show();
    return item;
  }
}
