import { workspace, Uri, FileSystemWatcher, type Disposable } from "vscode";
import { ServiceLimits } from "@/constants";
import type {
  DebouncingService,
  DebouncedFunction,
} from "@/infrastructure/services/optimization/DebouncingService";
import type {
  GitChangeDetectionService,
  ChangedFile,
} from "@/infrastructure/services/integration/GitChangeDetectionService";
import type { Logger } from "@/infrastructure/services";
import type { IndexCacheService } from "@/infrastructure/services/indexing/IndexCacheService";

export class FileWatcherManager {
  private fileWatcher: FileSystemWatcher | null = null;
  private debouncedUpdate: DebouncedFunction<(uri: Uri) => Promise<void>> | null = null;
  private disposables: Disposable[] = [];
  private gitUnsubscribe: (() => void) | null = null;

  constructor(
    private debouncingService: DebouncingService,
    private cacheService: IndexCacheService,
    private logger: Logger,
    private indexFile: (uri: Uri) => Promise<void>,
    private updateFileIndex: (uri: Uri) => Promise<void>,
    private removeFromIndex: (uri: Uri) => void,
    private gitChangeDetectionService?: GitChangeDetectionService,
  ) {}

  setupFileWatchers(): void {
    this.fileWatcher = workspace.createFileSystemWatcher("**/*");
    this.debouncedUpdate = this.debouncingService.debounce(
      (uri: Uri) => this.updateFileIndex(uri),
      ServiceLimits.indexDebounceDelay,
      { leading: false, trailing: true },
    );

    const debouncedCreate = this.debouncingService.debounce(
      async (uri: Uri) => {
        this.logger.debug("File created", { path: uri.fsPath });
        await this.indexFile(uri);
      },
      ServiceLimits.indexDebounceDelay,
      { leading: false, trailing: true },
    );

    const debouncedDelete = this.debouncingService.debounce(
      (uri: Uri) => {
        this.logger.debug("File deleted", { path: uri.fsPath });
        this.removeFromIndex(uri);
      },
      ServiceLimits.indexDebounceDelay,
      { leading: false, trailing: true },
    );

    this.fileWatcher.onDidCreate((uri) => {
      debouncedCreate(uri);
    });

    this.fileWatcher.onDidChange(async (uri) => {
      if (this.debouncedUpdate) {
        this.debouncedUpdate(uri);
      }
    });

    this.fileWatcher.onDidDelete((uri) => {
      debouncedDelete(uri);
    });

    this.disposables.push(this.fileWatcher);
  }

  setupGitBasedWatchers(): void {
    if (!this.gitChangeDetectionService) {
      this.logger.debug("Git change detection service not available, using FileSystemWatcher only");
      return;
    }

    this.gitUnsubscribe = this.gitChangeDetectionService.subscribeToChanges(
      async (changedFiles: ChangedFile[]) => {
        for (const changedFile of changedFiles) {
          if (changedFile.status === "deleted") {
            this.removeFromIndex(changedFile.uri);
          } else if (changedFile.status === "added" || changedFile.status === "modified") {
            if (this.debouncedUpdate) {
              this.debouncedUpdate(changedFile.uri);
            }
          }
        }

        if (changedFiles.length > 0) {
          await this.cacheService.persistIndex();
        }
      },
    );

    this.logger.info("Git-based file watchers initialized", {
      usingGitWatchers: true,
    });
  }

  dispose(): void {
    if (this.fileWatcher) {
      this.fileWatcher.dispose();
    }
    if (this.debouncedUpdate) {
      this.debouncedUpdate.cancel();
    }
    if (this.gitUnsubscribe) {
      this.gitUnsubscribe();
      this.gitUnsubscribe = null;
    }
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
  }

  getDebouncedUpdate(): DebouncedFunction<(uri: Uri) => Promise<void>> | null {
    return this.debouncedUpdate;
  }
}
