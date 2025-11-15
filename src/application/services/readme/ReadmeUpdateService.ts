import { EventBus } from "@/events/EventBus";
import { createLogger, type Logger } from "@/infrastructure/services";
import { LoggingService } from "@/infrastructure/services";
import { WikiStorageService } from "@/application/services/storage/WikiStorageService";
import { ReadmePromptOptimizationService } from "@/application/services/readme/ReadmePromptOptimizationService";
import { ReadmeStateDetectionService } from "@/application/services/readme/ReadmeStateDetectionService";
import { ReadmeContentAnalysisService } from "@/application/services/readme/ReadmeContentAnalysisService";
import { ReadmeBackupService } from "@/application/services/readme/ReadmeBackupService";
import { ReadmeFileService } from "@/application/services/readme/ReadmeFileService";
import { ReadmePromptBuilderService } from "@/application/services/readme/ReadmePromptBuilderService";
import {
  ReadmeDiffService,
  type ReadmeChangeSummary,
} from "@/application/services/readme/ReadmeDiffService";
import { ReadmeCacheService } from "@/application/services/readme/ReadmeCacheService";
import type { LLMRegistry } from "@/llm";
import type { ProviderId } from "@/llm/types";
import type { UpdateResult } from "@/domain/entities/ReadmeUpdate";
import { VSCodeDiffService } from "@/infrastructure/services";
import { ReadmeSyncTrackerService } from "@/application/services/readme/ReadmeSyncTrackerService";
import { VSCodeFileSystemService } from "@/infrastructure/services";
import {
  ReadmeWorkflowOrchestrator,
  type ReadmeUpdateConfig,
} from "./workflow/ReadmeWorkflowOrchestrator";
import { ReadmeContentGenerator } from "@/application/services/readme/generation/ReadmeContentGenerator";

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
  private workflowOrchestrator: ReadmeWorkflowOrchestrator;

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
    private eventBus: EventBus | undefined,
    loggingService: LoggingService,
  ) {
    this.logger = createLogger("ReadmeUpdateService");

    const contentGenerator = new ReadmeContentGenerator(
      llmRegistry,
      promptBuilderService,
      promptOptimizationService,
      cacheService,
      stateDetectionService,
      contentAnalysisService,
      loggingService,
    );

    this.workflowOrchestrator = new ReadmeWorkflowOrchestrator(
      wikiStorageService,
      fileService,
      stateDetectionService,
      contentAnalysisService,
      backupService,
      diffService,
      syncTracker,
      fileSystemService,
      contentGenerator,
      eventBus,
      loggingService,
    );
  }

  async updateReadmeFromWikis(
    wikiIds: string[],
    config: ReadmeUpdateConfig,
  ): Promise<UpdateResult> {
    return this.workflowOrchestrator.executeUpdate(wikiIds, config);
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
      state.updatedAt !== null && state.updatedAt !== undefined
        ? new Date(state.updatedAt).toLocaleString()
        : new Date().toLocaleString();
    return `README Update (${count} wiki${count === 1 ? "" : "s"} • ${timestamp})`;
  }
}
