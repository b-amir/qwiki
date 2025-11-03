import { extensions, Uri, Disposable } from "vscode";
import type { GitExtension, GitAPI, Repository } from "../../infrastructure/types/git";
import { LoggingService, createLogger, type Logger } from "./LoggingService";

export interface ChangedFile {
  uri: Uri;
  status: "modified" | "added" | "deleted";
}

export class GitChangeDetectionService {
  private logger: Logger;
  private gitAPI: GitAPI | undefined;
  private repositories: Repository[] = [];

  constructor(private loggingService: LoggingService) {
    this.logger = createLogger("GitChangeDetectionService", loggingService);
    this.initializeGitExtension();
  }

  private async initializeGitExtension(): Promise<void> {
    try {
      const gitExtension = extensions.getExtension<GitExtension>("vscode.git");
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
    } catch (error) {
      this.logger.error("Failed to initialize Git extension", error);
    }
  }

  async getChangedFiles(): Promise<ChangedFile[]> {
    if (!this.gitAPI || this.repositories.length === 0) {
      return [];
    }

    const changedFiles: ChangedFile[] = [];

    for (const repo of this.repositories) {
      try {
        const workingTreeChanges = repo.state.workingTreeChanges || [];
        const indexChanges = repo.state.indexChanges || [];

        for (const change of workingTreeChanges) {
          changedFiles.push({
            uri: change.uri,
            status: this.mapGitStatusToStatus(change.status),
          });
        }

        for (const change of indexChanges) {
          if (!changedFiles.some((f) => f.uri.fsPath === change.uri.fsPath)) {
            changedFiles.push({
              uri: change.uri,
              status: this.mapGitStatusToStatus(change.status),
            });
          }
        }
      } catch (error) {
        this.logger.error("Failed to get changed files from repository", {
          repoPath: repo.rootUri.fsPath,
          error,
        });
      }
    }

    return changedFiles;
  }

  async isFileChanged(uri: Uri): Promise<boolean> {
    const changedFiles = await this.getChangedFiles();
    return changedFiles.some((f) => f.uri.fsPath === uri.fsPath);
  }

  async getFileStatus(uri: Uri): Promise<"modified" | "added" | "deleted" | "unchanged"> {
    const changedFiles = await this.getChangedFiles();
    const file = changedFiles.find((f) => f.uri.fsPath === uri.fsPath);
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
          .catch((error) => {
            this.logger.error("Error in Git change callback", error);
          });
      });
      disposables.push(disposable);
    }

    return () => {
      disposables.forEach((dispose) => dispose.dispose());
    };
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
