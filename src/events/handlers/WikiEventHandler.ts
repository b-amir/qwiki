import { CancellationToken, CancellationTokenSource } from "vscode";
import type { EventBus } from "../EventBus";
import type { WikiGenerationRequest } from "../../domain/entities/Wiki";
import { InboundEvents, OutboundEvents } from "../../constants/Events";
import {
  ErrorLoggingService,
  ErrorRecoveryService,
  LoggingService,
  createLogger,
  type Logger,
  type ProviderValidationService,
} from "../../infrastructure/services";
import { ProviderError, ErrorCodes } from "../../errors";
import { qwikiStatusBarItem, HAS_ACTIVE_GENERATION_CONTEXT } from "../../extension";
import { VSCodeCommandIds } from "../../constants/Commands";
import { commands } from "vscode";
import { WikiGenerationExecutor } from "./WikiGenerationExecutor";

export class WikiEventHandler {
  private logger: Logger;
  private activeGenerationTokenSource: CancellationTokenSource | null = null;
  private generationExecutor: WikiGenerationExecutor | null = null;
  public static instance: WikiEventHandler | null = null;

  constructor(
    private eventBus: EventBus,
    private wikiService: any,
    private projectContextService: any,
    private errorRecoveryService: ErrorRecoveryService,
    private errorLoggingService: ErrorLoggingService,
    private providerValidationService: ProviderValidationService,
    private loggingService: LoggingService = new LoggingService({
      mode: "none",
      includeTimestamp: true,
      includeService: true,
    }),
  ) {
    this.logger = createLogger("WikiEventHandler");
    WikiEventHandler.instance = this;
    this.initializeGenerationExecutor();
  }

  private initializeGenerationExecutor(): void {
    this.generationExecutor = new WikiGenerationExecutor(
      this.eventBus,
      this.wikiService,
      this.projectContextService,
      this.errorRecoveryService,
      this.errorLoggingService,
      this.providerValidationService,
      this.loggingService,
      this.updateStatusBar.bind(this),
      this.resetStatusBar.bind(this),
    );
  }

  register(): void {
    this.logger.debug("WikiEventHandler.register started");
    this.eventBus.subscribe(InboundEvents.generateWiki, this.handleGenerateWiki.bind(this));
    this.logger.debug("WikiEventHandler registered for generateWiki event");
    this.eventBus.subscribe(InboundEvents.getRelated, this.handleGetRelated.bind(this));
    this.logger.debug("WikiEventHandler registered for getRelated event");
    this.logger.debug("WikiEventHandler.register completed");
  }

  cancelActiveGeneration(): void {
    if (this.activeGenerationTokenSource) {
      this.logger.debug("Cancelling active generation");
      this.activeGenerationTokenSource.cancel();
      this.activeGenerationTokenSource.dispose();
      this.activeGenerationTokenSource = null;

      this.eventBus.publish(OutboundEvents.generationCancelled, {});

      this.eventBus.publish(OutboundEvents.error, {
        code: ErrorCodes.GENERATION_CANCELLED,
        message: "Generation cancelled by user",
        suggestions: [],
        timestamp: new Date().toISOString(),
      });
    }
    this.setActiveGenerationContext(false);
    this.resetStatusBar();
  }

  hasActiveGeneration(): boolean {
    return this.activeGenerationTokenSource !== null;
  }

  private setActiveGenerationContext(active: boolean): void {
    commands.executeCommand("setContext", HAS_ACTIVE_GENERATION_CONTEXT, active);
  }

  private updateStatusBar(message: string): void {
    if (qwikiStatusBarItem) {
      qwikiStatusBarItem.text = `$(sync~spin) ${message}`;
      qwikiStatusBarItem.tooltip = `Qwiki: ${message}\n\nClick to open Qwiki commands.`;
      qwikiStatusBarItem.command = VSCodeCommandIds.showCommands;
      qwikiStatusBarItem.show();
    }
  }

  private resetStatusBar(): void {
    if (qwikiStatusBarItem) {
      qwikiStatusBarItem.text = "Qwiki";
      qwikiStatusBarItem.tooltip = "Click to open Qwiki commands";
      qwikiStatusBarItem.command = VSCodeCommandIds.showCommands;
    }
  }

  private async handleGenerateWiki(payload: WikiGenerationRequest): Promise<void> {
    if (this.activeGenerationTokenSource) {
      this.logger.debug("Cancelling previous generation");
      this.activeGenerationTokenSource.cancel();
      this.activeGenerationTokenSource.dispose();
    }

    this.activeGenerationTokenSource = new CancellationTokenSource();
    this.setActiveGenerationContext(true);

    try {
      return await this.executeWikiGeneration(payload, this.activeGenerationTokenSource.token);
    } finally {
      this.setActiveGenerationContext(false);
      this.resetStatusBar();
      if (this.activeGenerationTokenSource) {
        this.activeGenerationTokenSource.dispose();
        this.activeGenerationTokenSource = null;
      }
    }
  }

  private async executeWikiGeneration(
    payload: WikiGenerationRequest,
    cancellationToken: CancellationToken,
  ): Promise<void> {
    if (!this.generationExecutor) {
      this.initializeGenerationExecutor();
    }
    await this.generationExecutor!.execute(payload, cancellationToken);
  }

  private async handleGetRelated(_payload: { filePath: string }): Promise<void> {
    try {
      const projectContext = await this.projectContextService.buildContext("");

      this.eventBus.publish(OutboundEvents.related, {
        rootName: projectContext.rootName,
        overview: projectContext.overview,
        filesSample: projectContext.filesSample,
        related: projectContext.related,
      });
    } catch (error: any) {
      const providerError = ProviderError.fromError(error);

      this.logger.error("Exception in handleGetRelated", {
        code: providerError.code,
        message: providerError.message,
        filePath: _payload?.filePath,
        originalError: error,
      });

      this.errorLoggingService.logError(providerError);
      const suggestion = this.errorRecoveryService.getActionableSuggestion(providerError);
      this.eventBus.publish(OutboundEvents.error, {
        code: providerError.code,
        message: this.errorRecoveryService.getUserFriendlyMessage(providerError),
        suggestion: suggestion,
        suggestions: suggestion ? [suggestion] : undefined,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
