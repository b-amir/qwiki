import { CancellationToken, CancellationTokenSource, window } from "vscode";
import type { EventBus } from "@/events/EventBus";
import { OutboundEvents } from "@/constants/Events";
import { ErrorCodes } from "@/errors";
import { LoggingService, createLogger, type Logger } from "@/infrastructure/services";

export class ReadmeEventHandler {
  private logger: Logger;
  private activeGenerationTokenSource: CancellationTokenSource | null = null;
  public static instance: ReadmeEventHandler | null = null;

  constructor(
    private eventBus: EventBus,
    private loggingService: LoggingService = new LoggingService(),
  ) {
    this.logger = createLogger("ReadmeEventHandler");
    ReadmeEventHandler.instance = this;
  }

  register(): void {
    this.logger.debug("ReadmeEventHandler registered");
  }

  cancelActiveGeneration(reason?: string): void {
    if (this.activeGenerationTokenSource) {
      this.logger.debug("Cancelling active README generation", { reason });
      this.activeGenerationTokenSource.cancel();
      this.activeGenerationTokenSource.dispose();
      this.activeGenerationTokenSource = null;

      const notificationMessage = reason || "README generation cancelled";
      window.showInformationMessage(`Qwiki: ${notificationMessage}`);

      this.eventBus.publish(OutboundEvents.readmeGenerationCancelled, {});

      this.eventBus.publish(OutboundEvents.error, {
        code: ErrorCodes.GENERATION_CANCELLED,
        message: "README generation cancelled by user",
        suggestions: [],
        timestamp: new Date().toISOString(),
      });
    }
  }

  hasActiveGeneration(): boolean {
    return this.activeGenerationTokenSource !== null;
  }

  createCancellationToken(): CancellationToken {
    if (this.activeGenerationTokenSource) {
      this.logger.debug("Cancelling previous README generation");
      this.activeGenerationTokenSource.cancel();
      this.activeGenerationTokenSource.dispose();
      window.showInformationMessage(
        "Qwiki: Previous README generation cancelled - starting new request",
      );
    }

    this.activeGenerationTokenSource = new CancellationTokenSource();
    return this.activeGenerationTokenSource.token;
  }

  dispose(): void {
    if (this.activeGenerationTokenSource) {
      this.activeGenerationTokenSource.cancel();
      this.activeGenerationTokenSource.dispose();
      this.activeGenerationTokenSource = null;
    }
  }
}
