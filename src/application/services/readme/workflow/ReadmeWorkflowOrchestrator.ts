import { EventBus } from "@/events/EventBus";
import { createLogger, type Logger } from "@/infrastructure/services";
import { LoggingService } from "@/infrastructure/services";
import { WikiStorageService } from "@/application/services/storage/WikiStorageService";
import {
  ReadmeStateDetectionService,
  ReadmeState,
} from "@/application/services/readme/ReadmeStateDetectionService";
import { ReadmeContentAnalysisService } from "@/application/services/readme/ReadmeContentAnalysisService";
import { ReadmeBackupService } from "@/application/services/readme/ReadmeBackupService";
import { ReadmeFileService } from "@/application/services/readme/ReadmeFileService";
import {
  ReadmeDiffService,
  type ReadmeChangeSummary,
} from "@/application/services/readme/ReadmeDiffService";
import { ReadmeSyncTrackerService } from "@/application/services/readme/ReadmeSyncTrackerService";
import { VSCodeFileSystemService } from "@/infrastructure/services";
import { LoadingSteps } from "@/constants/loading";
import type { UpdateResult } from "@/domain/entities/ReadmeUpdate";
import {
  ReadmeContentGenerator,
  type GenerationContext,
} from "../generation/ReadmeContentGenerator";
import type { ProviderId } from "@/llm/types";
import { ServiceLimits } from "@/constants/ServiceLimits";

export interface ReadmeUpdateConfig {
  providerId: ProviderId;
  model?: string;
  backupOriginal?: boolean;
  timeout?: number;
}

export class ReadmeWorkflowOrchestrator {
  private logger: Logger;

  constructor(
    private wikiStorageService: WikiStorageService,
    private fileService: ReadmeFileService,
    private stateDetectionService: ReadmeStateDetectionService,
    private contentAnalysisService: ReadmeContentAnalysisService,
    private backupService: ReadmeBackupService,
    private diffService: ReadmeDiffService,
    private syncTracker: ReadmeSyncTrackerService,
    private fileSystemService: VSCodeFileSystemService,
    private contentGenerator: ReadmeContentGenerator,
    private eventBus: EventBus | undefined,
    loggingService: LoggingService,
  ) {
    this.logger = createLogger("ReadmeWorkflowOrchestrator");
  }

  private emitProgress(step: string, percent?: number): void {
    if (this.eventBus) {
      this.eventBus.publish("readmeUpdateProgress", {
        step,
        percent,
      });
    }
  }

  async executeUpdate(wikiIds: string[], config: ReadmeUpdateConfig): Promise<UpdateResult> {
    this.logger.debug(`Updating README from ${wikiIds.length} wikis`);

    let backupPath: string | undefined;
    try {
      const context = await this.prepareContext(wikiIds, config);

      if (context.readmeState === ReadmeState.USER_CONTRIBUTED) {
        this.logger.warn("Attempting to overwrite user-contributed README", {
          state: context.readmeState,
        });

        if (this.eventBus) {
          await this.eventBus.publish("readmeOverwriteWarning", {
            state: context.readmeState,
            requiresConfirmation: true,
          });
        }

        this.logger.warn("Proceeding with overwrite - confirmation flow not yet implemented");
      }

      backupPath = await this.handleBackup(context.currentReadme, config);

      const generatedContent = await this.contentGenerator.generateContent(
        context,
        config.providerId,
        config.model,
        config.timeout ?? ServiceLimits.readmeTimeoutDefault,
        (step, percent) => this.emitProgress(step, percent),
      );

      const changeSummary = await this.applyChanges(
        context.currentReadme,
        generatedContent,
        context.sortedWikiIds,
        backupPath,
      );

      this.emitCompletion(wikiIds, changeSummary);

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

  private async prepareContext(
    wikiIds: string[],
    config: ReadmeUpdateConfig,
  ): Promise<GenerationContext> {
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

    const sortedWikiIds = [...wikiIds].sort();
    const readmeState = stateResult?.state ?? ReadmeState.BOILERPLATE;

    return {
      currentReadme,
      readmeState,
      isBoilerplate,
      wikis,
      sortedWikiIds,
    };
  }

  private async handleBackup(
    currentReadme: string,
    config: ReadmeUpdateConfig,
  ): Promise<string | undefined> {
    if (config.backupOriginal) {
      this.emitProgress(LoadingSteps.creatingBackup, 30);
      return this.backupService.createBackup(currentReadme);
    }
    return undefined;
  }

  private async applyChanges(
    currentReadme: string,
    generatedContent: string,
    sortedWikiIds: string[],
    backupPath: string | undefined,
  ): Promise<ReadmeChangeSummary> {
    const preview = this.diffService.generatePreview(currentReadme, generatedContent);
    const changeSummary = this.diffService.summarizeChanges(preview.changes);

    this.emitProgress(LoadingSteps.writingReadmeFile, 95);
    await this.fileService.writeReadme(generatedContent);

    const readmePath = this.fileService.getReadmePath();
    if (readmePath) {
      await this.syncTracker.recordSync({
        wikiIds: sortedWikiIds,
        backupPath,
        readmePath,
        updatedAt: Date.now(),
        changeSummary,
      });
    }

    return changeSummary;
  }

  private emitCompletion(wikiIds: string[], changeSummary: ReadmeChangeSummary): void {
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
    });
  }
}
