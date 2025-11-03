import { EventBus } from "../../events/EventBus";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "../../infrastructure/services/LoggingService";
import { WikiStorageService } from "./WikiStorageService";
import { ReadmePromptOptimizationService } from "./ReadmePromptOptimizationService";
import { ReadmeStateDetectionService, ReadmeState } from "./ReadmeStateDetectionService";
import { ReadmeContentAnalysisService } from "./ReadmeContentAnalysisService";
import { ReadmeBackupService } from "./ReadmeBackupService";
import { ReadmeFileService } from "./ReadmeFileService";
import { ReadmePromptBuilderService } from "./ReadmePromptBuilderService";
import { ReadmeDiffService } from "./ReadmeDiffService";
import { ReadmeCacheService } from "./ReadmeCacheService";
import type { LLMRegistry } from "../../llm";
import type { ProviderId } from "../../llm/types";
import type { UpdateResult, ReadmePreview } from "../../domain/entities/ReadmeUpdate";
import { ServiceLimits } from "../../constants/ServiceLimits";
import { LoadingSteps } from "../../constants/loading";

export interface ReadmeUpdateConfig {
  providerId: ProviderId;
  model?: string;
  backupOriginal?: boolean;
  timeout?: number;
}

export class ReadmeUpdateService {
  private logger: Logger;

  private pendingUpdate: {
    wikiIds: string[];
    config: ReadmeUpdateConfig;
    generatedContent: string;
    preview?: ReadmePreview;
  } | null = null;

  constructor(
    private wikiStorageService: WikiStorageService,
    private llmRegistry: LLMRegistry,
    private promptOptimizationService: ReadmePromptOptimizationService,
    private promptBuilderService: ReadmePromptBuilderService,
    private stateDetectionService: ReadmeStateDetectionService,
    private contentAnalysisService: ReadmeContentAnalysisService,
    private backupService: ReadmeBackupService,
    private fileService: ReadmeFileService,
    private diffService: ReadmeDiffService,
    private cacheService: ReadmeCacheService,
    private loggingService: LoggingService,
    private eventBus?: EventBus,
  ) {
    this.logger = createLogger("ReadmeUpdateService", loggingService);
  }

  private emitProgress(step: string, percent?: number): void {
    if (this.eventBus) {
      this.eventBus.publish("readmeUpdateProgress", {
        step,
        percent,
      });
    }
  }

  async updateReadmeFromWikis(
    wikiIds: string[],
    config: ReadmeUpdateConfig,
  ): Promise<UpdateResult> {
    this.logger.debug(`Updating README from ${wikiIds.length} wikis`);

    try {
      this.emitProgress(LoadingSteps.analyzingWikis, 10);

      const allWikis = await this.wikiStorageService.getAllSavedWikis();
      const wikis = allWikis.filter((w) => wikiIds.includes(w.id));

      if (wikis.length === 0) {
        throw new Error("No wikis found for the provided IDs");
      }

      this.emitProgress(LoadingSteps.detectingReadmeState, 20);

      const currentReadme = await this.fileService.readReadme();
      const readmePath = this.fileService.getReadmePath();
      const stateResult = readmePath
        ? await this.stateDetectionService.detectReadmeState(readmePath)
        : null;
      const contentAnalysis = currentReadme
        ? this.contentAnalysisService.analyze(currentReadme)
        : null;

      const isBoilerplate =
        stateResult?.state === ReadmeState.BOILERPLATE ||
        stateResult?.state === ReadmeState.NON_EXISTENT ||
        stateResult?.state === ReadmeState.AUTO_GENERATED ||
        (contentAnalysis?.isBoilerplate ?? false);

      this.logger.info("README state detected", {
        state: stateResult?.state,
        confidence: stateResult?.confidence,
        isBoilerplate,
      });

      this.emitProgress(LoadingSteps.detectingReadmeState, 30);

      let backupPath: string | undefined;
      if (config.backupOriginal) {
        backupPath = await this.backupService.createBackup(currentReadme);
      }

      this.emitProgress(LoadingSteps.buildingPrompt, 40);

      const optimized = await this.promptOptimizationService.optimizeWikiSelection(
        wikis,
        config.providerId,
        config.model,
        currentReadme.length,
      );

      const sortedWikiIds = [...wikiIds].sort();
      const cachedContent = await this.cacheService.getCachedReadme(sortedWikiIds, currentReadme);

      let generatedContent: string;

      if (cachedContent) {
        this.logger.info("Using cached README generation result", {
          wikiCount: sortedWikiIds.length,
        });
        this.emitProgress(LoadingSteps.generatingReadme, 90);
        generatedContent = cachedContent;
      } else {
        const readmeState = stateResult?.state ?? ReadmeState.BOILERPLATE;
        const prompt = await this.promptBuilderService.buildPrompt(
          currentReadme,
          optimized.included,
          optimized.excluded,
          isBoilerplate,
          readmeState,
        );

        this.emitProgress(LoadingSteps.generatingReadme, 50);

        const timeout = config.timeout ?? ServiceLimits.readmeTimeoutDefault;

        const generatePromise = this.llmRegistry.generate(config.providerId, {
          model: config.model,
          snippet: prompt,
          languageId: "markdown",
          filePath: "README.md",
        });

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Request timeout")), timeout),
        );

        const result = await Promise.race([generatePromise, timeoutPromise]);

        this.emitProgress(LoadingSteps.generatingReadme, 90);
        generatedContent = result.content;

        await this.cacheService.cacheReadme(sortedWikiIds, currentReadme, generatedContent);
      }

      if (stateResult?.state === ReadmeState.USER_CONTRIBUTED && config.backupOriginal !== false) {
        const preview = this.diffService.generatePreview(currentReadme, generatedContent);
        const changeSummary = this.diffService.summarizeChanges(preview.changes);

        this.pendingUpdate = {
          wikiIds,
          config,
          generatedContent,
          preview,
        };

        if (this.eventBus) {
          this.eventBus.publish("readmeUpdatePreviewReady", {
            preview,
            changeSummary,
            hasBackup: !!backupPath,
          });
          this.eventBus.publish("readmeUpdateApprovalRequested", {});
        }

        this.logger.info("README update preview generated, waiting for user approval", {
          changes: changeSummary,
          warnings: preview.warnings.length,
        });

        return {
          success: false,
          changes: [],
          conflicts: ["Waiting for user approval"],
          requiresApproval: true,
        };
      }

      this.emitProgress(LoadingSteps.writingReadme, 95);

      await this.fileService.writeReadme(generatedContent);

      this.emitProgress(LoadingSteps.writingReadme, 100);

      if (this.eventBus) {
        this.eventBus.publish("readme-updated", {
          wikiCount: optimized.included.length,
          excludedCount: optimized.excluded.length,
        });
      }

      return {
        success: true,
        changes: ["README updated successfully"],
        backupPath,
        conflicts: [],
      };
    } catch (error) {
      this.logger.error("Failed to update README", error);
      return {
        success: false,
        changes: [],
        conflicts: [
          `Failed to update README: ${error instanceof Error ? error.message : "Unknown error"}`,
        ],
      };
    }
  }

  async undoReadmeUpdate(): Promise<{ success: boolean; error?: string }> {
    return this.backupService.restoreFromBackup((content) => this.fileService.writeReadme(content));
  }

  async approvePendingUpdate(): Promise<UpdateResult> {
    if (!this.pendingUpdate) {
      throw new Error("No pending update to approve");
    }

    const { generatedContent, config, wikiIds } = this.pendingUpdate;

    try {
      this.emitProgress(LoadingSteps.writingReadme, 95);

      await this.fileService.writeReadme(generatedContent);

      this.emitProgress(LoadingSteps.writingReadme, 100);

      if (this.eventBus) {
        this.eventBus.publish("readmeUpdateApproved", {});
        this.eventBus.publish("readme-updated", {
          wikiCount: wikiIds.length,
        });
      }

      this.logger.info("Pending README update approved and applied");
      this.pendingUpdate = null;

      return {
        success: true,
        changes: ["README updated successfully"],
        conflicts: [],
      };
    } catch (error) {
      this.logger.error("Failed to apply approved README update", error);
      this.pendingUpdate = null;
      throw error;
    }
  }

  cancelPendingUpdate(): void {
    if (!this.pendingUpdate) {
      return;
    }

    this.logger.info("Pending README update cancelled by user");

    if (this.eventBus) {
      this.eventBus.publish("readmeUpdateCancelled", {});
    }

    this.pendingUpdate = null;
  }

  getPendingPreview(): ReadmePreview | null {
    return this.pendingUpdate?.preview ?? null;
  }

  getBackupState(): boolean {
    return this.backupService.getBackupState();
  }
}
