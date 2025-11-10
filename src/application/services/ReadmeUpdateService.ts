import { EventBus } from "../../events/EventBus";
import { createLogger, type Logger } from "../../infrastructure/services/LoggingService";
import { WikiStorageService } from "./WikiStorageService";
import { ReadmePromptOptimizationService } from "./ReadmePromptOptimizationService";
import { ReadmeStateDetectionService, ReadmeState } from "./ReadmeStateDetectionService";
import { ReadmeContentAnalysisService } from "./ReadmeContentAnalysisService";
import { ReadmeBackupService } from "./ReadmeBackupService";
import { ReadmeFileService } from "./ReadmeFileService";
import { ReadmePromptBuilderService } from "./ReadmePromptBuilderService";
import { ReadmeDiffService, type ReadmeChangeSummary } from "./ReadmeDiffService";
import { ReadmeCacheService } from "./ReadmeCacheService";
import type { LLMRegistry } from "../../llm";
import type { ProviderId } from "../../llm/types";
import type { UpdateResult } from "../../domain/entities/ReadmeUpdate";
import { ServiceLimits } from "../../constants/ServiceLimits";
import { LoadingSteps } from "../../constants/loading";
import { VSCodeDiffService } from "../../infrastructure/services/VSCodeDiffService";
import { ReadmeSyncTrackerService } from "./ReadmeSyncTrackerService";
import { VSCodeFileSystemService } from "../../infrastructure/services/VSCodeFileSystemService";

export interface ReadmeUpdateConfig {
  providerId: ProviderId;
  model?: string;
  backupOriginal?: boolean;
  timeout?: number;
}

export interface ReadmeStatus {
  isSynced: boolean;
  hasBackup: boolean;
  diffAvailable: boolean;
  syncedWikiIds: string[];
  lastUpdatedAt?: number;
  changeSummary?: ReadmeChangeSummary;
}

export class ReadmeUpdateService {
  private logger: Logger;

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
    private diffViewer: VSCodeDiffService,
    private cacheService: ReadmeCacheService,
    private syncTracker: ReadmeSyncTrackerService,
    private fileSystemService: VSCodeFileSystemService,
    private eventBus?: EventBus,
  ) {
    this.logger = createLogger("ReadmeUpdateService");
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

    let backupPath: string | undefined;
    try {
      this.emitProgress(LoadingSteps.loadingSavedWikis, 10);

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

      if (config.backupOriginal) {
        this.emitProgress(LoadingSteps.creatingBackup, 30);
        backupPath = await this.backupService.createBackup(currentReadme);
      }

      this.emitProgress(LoadingSteps.optimizingWikiSelection, 40);

      const optimized = await this.promptOptimizationService.optimizeWikiSelection(
        wikis,
        config.providerId,
        config.model,
        currentReadme.length,
      );

      this.emitProgress(LoadingSteps.buildingReadmePrompt, 50);

      const sortedWikiIds = [...wikiIds].sort();
      const cachedContent = await this.cacheService.getCachedReadme(sortedWikiIds, currentReadme);

      let generatedContent: string;

      if (cachedContent) {
        this.logger.info("Using cached README generation result", {
          wikiCount: sortedWikiIds.length,
        });
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

        const timeout = config.timeout ?? ServiceLimits.readmeTimeoutDefault;

        this.emitProgress(LoadingSteps.generatingReadmeContent, 60);

        const generatePromise = this.llmRegistry.generate(config.providerId, {
          model: config.model,
          snippet: prompt,
          languageId: "markdown",
          filePath: "README.md",
          timeoutMs: timeout,
        });

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Request timeout")), timeout),
        );

        const result = await Promise.race([generatePromise, timeoutPromise]);

        generatedContent = result.content;

        await this.cacheService.cacheReadme(sortedWikiIds, currentReadme, generatedContent);
      }

      const preview = this.diffService.generatePreview(currentReadme, generatedContent);
      const changeSummary = this.diffService.summarizeChanges(preview.changes);

      this.emitProgress(LoadingSteps.writingReadmeFile, 95);
      await this.fileService.writeReadme(generatedContent);

      if (readmePath) {
        await this.syncTracker.recordSync({
          wikiIds: sortedWikiIds,
          backupPath,
          readmePath,
          updatedAt: Date.now(),
          changeSummary,
        });
      }

      if (this.eventBus) {
        this.eventBus.publish("readmeUpdateProgress", {
          step: LoadingSteps.writingReadmeFile,
          percent: 100,
        });
        this.eventBus.publish("readme-updated", {
          wikiCount: wikiIds.length,
          summary: changeSummary,
        });
      }

      this.logger.info("README updated successfully", {
        wikiCount: wikiIds.length,
        summary: changeSummary,
        hasBackup: !!backupPath,
      });

      const summaryText = `+${changeSummary.added} ~${changeSummary.updated} -${changeSummary.removed} ✓${changeSummary.preserved}`;

      return {
        success: true,
        changes: [`README updated (${summaryText})`],
        conflicts: [],
        backupPath,
        requiresApproval: false,
      };
    } catch (error) {
      this.logger.error("Failed to update README", error);
      if (backupPath) {
        await this.backupService.deleteBackup();
      }
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
    const result = await this.backupService.restoreFromBackup((content) =>
      this.fileService.writeReadme(content),
    );
    if (result.success) {
      await this.syncTracker.clear();
    }
    return result;
  }

  getBackupState(): boolean {
    return this.backupService.getBackupState();
  }

  async showLatestDiff(): Promise<void> {
    const state = await this.syncTracker.getState();
    if (!state || !state.backupPath || !state.readmePath) {
      throw new Error("No README diff is available");
    }

    const backupExists = await this.fileSystemService.fileExists(state.backupPath);
    if (!backupExists) {
      throw new Error("README backup no longer exists");
    }

    const readmeExists = await this.fileSystemService.fileExists(state.readmePath);
    if (!readmeExists) {
      throw new Error("README file not found");
    }

    const diffTitle = this.buildDiffTitle(state);
    await this.diffViewer.showDiff(state.backupPath, state.readmePath, diffTitle);
  }

  async getReadmeStatus(currentWikiIds: string[]): Promise<ReadmeStatus> {
    const sortedIds = [...currentWikiIds].sort();
    const state = await this.syncTracker.getState();
    const hasBackup = this.backupService.getBackupState();

    const isSynced =
      !!state &&
      state.wikiIds.length === sortedIds.length &&
      state.wikiIds.every((id, index) => id === sortedIds[index]);

    const diffAvailable =
      !!state?.backupPath &&
      hasBackup &&
      (await this.fileSystemService.fileExists(state.backupPath));

    return {
      isSynced,
      hasBackup,
      diffAvailable,
      syncedWikiIds: state?.wikiIds ?? [],
      lastUpdatedAt: state?.updatedAt,
      changeSummary: state?.changeSummary,
    };
  }

  private buildDiffTitle(state: { wikiIds: string[]; updatedAt?: number }): string {
    const count = state.wikiIds.length;
    const timestamp =
      state.updatedAt != null
        ? new Date(state.updatedAt).toLocaleString()
        : new Date().toLocaleString();
    return `README Update (${count} wiki${count === 1 ? "" : "s"} • ${timestamp})`;
  }
}
