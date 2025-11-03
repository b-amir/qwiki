import { extensions, Uri, Disposable, type ExtensionContext } from "vscode";
import type { GitExtension, GitAPI, Repository } from "../../infrastructure/types/git";
import { LoggingService, createLogger, type Logger } from "./LoggingService";
import type { EventBus } from "../../events/EventBus";
import { OutboundEvents } from "../../constants/Events";
import { ErrorCodes } from "../../constants/ErrorCodes";
import { Extension } from "../../constants/Extension";

export interface ChangedFile {
  uri: Uri;
  status: "modified" | "added" | "deleted";
}

export class GitChangeDetectionService {
  private logger: Logger;
  private gitAPI: GitAPI | undefined;
  private repositories: Repository[] = [];
  private disposables: Disposable[] = [];

  constructor(
    private loggingService: LoggingService,
    private eventBus?: EventBus,
    private extensionContext?: ExtensionContext,
  ) {
    this.logger = createLogger("GitChangeDetectionService", loggingService);
    this.initializeGitExtension();
  }

  private async initializeGitExtension(): Promise<void> {
    try {
      const gitExtension = extensions.getExtension<GitExtension>(Extension.gitExtensionId);
      if (!gitExtension) {
        this.logger.debug("Git extension not found");
        return;
      }

      if (!gitExtension.isActive) {
        await gitExtension.activate();
      }

      const api = gitExtension.exports.getAPI(1);
      if (!api) {
        this.logger.debug("Git API not available");
        return;
      }

      this.gitAPI = api;
      this.repositories = api.repositories;

      this.logger.info("Git extension initialized", {
        repositoryCount: this.repositories.length,
      });
    } catch (error: any) {
      this.logger.error("Failed to initialize Git extension", error);
      this.publishError(
        "Failed to initialize Git change detection",
        ErrorCodes.unknown,
        "Git extension may not be available. File indexing will use filesystem watchers instead.",
        { error: error?.message },
        error?.message,
      );
    }
  }

  async getChangedFiles(): Promise<ChangedFile[]> {
    if (!this.gitAPI || this.repositories.length === 0) {
      return [];
    }

    const changedFilesMap = new Map<string, ChangedFile>();

    for (const repo of this.repositories) {
      try {
        const workingTreeChanges = repo.state.workingTreeChanges || [];
        const indexChanges = repo.state.indexChanges || [];

        for (const change of workingTreeChanges) {
          changedFilesMap.set(change.uri.fsPath, {
            uri: change.uri,
            status: this.mapGitStatusToStatus(change.status),
          });
        }

        for (const change of indexChanges) {
          if (!changedFilesMap.has(change.uri.fsPath)) {
            changedFilesMap.set(change.uri.fsPath, {
              uri: change.uri,
              status: this.mapGitStatusToStatus(change.status),
            });
          }
        }
      } catch (error: any) {
        this.logger.error("Failed to get changed files from repository", {
          repoPath: repo.rootUri.fsPath,
          error,
        });
        this.publishError(
          "Failed to retrieve Git changes",
          ErrorCodes.unknown,
          "Git change detection may be temporarily unavailable.",
          { repoPath: repo.rootUri.fsPath, error: error?.message },
          error?.message,
        );
      }
    }

    return Array.from(changedFilesMap.values());
  }

  async isFileChanged(uri: Uri): Promise<boolean> {
    const changedFiles = await this.getChangedFiles();
    const changedPathsSet = new Set(changedFiles.map((f) => f.uri.fsPath));
    return changedPathsSet.has(uri.fsPath);
  }

  async getFileStatus(uri: Uri): Promise<"modified" | "added" | "deleted" | "unchanged"> {
    const changedFiles = await this.getChangedFiles();
    const changedFilesMap = new Map<string, ChangedFile>();
    for (const file of changedFiles) {
      changedFilesMap.set(file.uri.fsPath, file);
    }
    const file = changedFilesMap.get(uri.fsPath);
    return file ? file.status : "unchanged";
  }

  subscribeToChanges(callback: (changedFiles: ChangedFile[]) => void): () => void {
    if (!this.gitAPI || this.repositories.length === 0) {
      return () => {};
    }

    const disposables: Disposable[] = [];

    for (const repo of this.repositories) {
      const disposable = repo.state.onDidChange(() => {
        this.getChangedFiles()
          .then(callback)
          .catch((error: any) => {
            this.logger.error("Error in Git change callback", error);
            this.publishError(
              "Git change detection callback failed",
              ErrorCodes.unknown,
              "File indexing may not update automatically.",
              { error: error?.message },
              error?.message,
            );
          });
      });
      disposables.push(disposable);
      if (this.extensionContext?.subscriptions) {
        this.extensionContext.subscriptions.push(disposable);
      }
    }

    this.disposables.push(...disposables);

    return () => {
      disposables.forEach((dispose) => dispose.dispose());
    };
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
  }

  private publishError(
    message: string,
    code: string,
    suggestion?: string,
    context?: any,
    originalError?: string,
  ): void {
    if (!this.eventBus) {
      return;
    }

    this.eventBus.publish(OutboundEvents.error, {
      code,
      message,
      suggestions: suggestion ? [suggestion] : undefined,
      suggestion,
      timestamp: new Date().toISOString(),
      context: context ? JSON.stringify(context) : undefined,
      originalError,
    });
  }

  private mapGitStatusToStatus(gitStatus: number): "modified" | "added" | "deleted" {
    if (gitStatus === 1 || gitStatus === 2) {
      return "added";
    }
    if (gitStatus === 3 || gitStatus === 4) {
      return "deleted";
    }
    return "modified";
  }
}
