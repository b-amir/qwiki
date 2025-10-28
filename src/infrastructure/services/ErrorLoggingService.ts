import type { EventBus } from "../../events";
import { ErrorEvents } from "../../constants/Events";
import { window } from "vscode";

export interface ErrorLoggingService {
  logError(errorInfo: any): Promise<void>;
  logRecoveryAttempt(errorInfo: any): Promise<void>;
  logRecoverySuccess(errorInfo: any): Promise<void>;
  logRecoveryFailed(errorInfo: any): Promise<void>;
}

export class ErrorLoggingServiceImpl implements ErrorLoggingService {
  constructor(private eventBus: EventBus) {
    this.setupEventHandlers();
  }

  async logError(errorInfo: any): Promise<void> {
    const logMessage = `[${errorInfo.timestamp.toISOString()}] ${errorInfo.name}: ${errorInfo.message}`;

    if (errorInfo.context) {
      console.error(`${logMessage}\nContext:`, errorInfo.context);
    } else {
      console.error(logMessage);
    }

    if (errorInfo.stack) {
      console.error("Stack trace:", errorInfo.stack);
    }

    this.showUserNotification(errorInfo);
  }

  async logRecoveryAttempt(errorInfo: any): Promise<void> {
    const logMessage = `[${new Date().toISOString()}] Attempting recovery for ${errorInfo.code}`;
    console.log(logMessage);
  }

  async logRecoverySuccess(errorInfo: any): Promise<void> {
    const logMessage = `[${new Date().toISOString()}] Recovery successful for ${errorInfo.code}`;
    console.log(logMessage);
  }

  async logRecoveryFailed(errorInfo: any): Promise<void> {
    const logMessage = `[${new Date().toISOString()}] Recovery failed for ${errorInfo.code}`;
    console.error(logMessage);
  }

  private setupEventHandlers(): void {
    this.eventBus.subscribe(ErrorEvents.occurred, (errorInfo) => {
      this.logError(errorInfo);
    });

    this.eventBus.subscribe(ErrorEvents.recoveryAttempt, (errorInfo) => {
      this.logRecoveryAttempt(errorInfo);
    });

    this.eventBus.subscribe(ErrorEvents.recoverySuccess, (errorInfo) => {
      this.logRecoverySuccess(errorInfo);
    });

    this.eventBus.subscribe(ErrorEvents.recoveryFailed, (errorInfo) => {
      this.logRecoveryFailed(errorInfo);
    });
  }

  private showUserNotification(errorInfo: any): void {
    const userMessages: Record<string, string> = {
      "error.generationFailed": "Failed to generate wiki documentation",
      "error.invalidSelection": "Invalid selection detected",
      "error.missingSnippet": "No code selected for documentation",
      "error.missingProvider": "LLM provider not configured",
      "error.invalidConfiguration": "Invalid configuration detected",
      "error.missingCommand": "Command not found",
    };

    const message = userMessages[errorInfo.code] || "An unexpected error occurred";

    window.showErrorMessage(message, "Show Details").then((selection) => {
      if (selection === "Show Details") {
        this.showErrorDetails(errorInfo);
      }
    });
  }

  private showErrorDetails(errorInfo: any): void {
    const details = [
      `Error: ${errorInfo.name}`,
      `Code: ${errorInfo.code}`,
      `Message: ${errorInfo.message}`,
      `Time: ${errorInfo.timestamp.toISOString()}`,
    ];

    if (errorInfo.context) {
      details.push(`Context: ${JSON.stringify(errorInfo.context, null, 2)}`);
    }

    window.showInformationMessage(details.join("\n"), "Close");
  }
}
