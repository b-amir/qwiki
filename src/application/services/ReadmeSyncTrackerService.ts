import { workspace } from "vscode";
import { join } from "path";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "../../infrastructure/services/LoggingService";
import { VSCodeFileSystemService } from "../../infrastructure/services/VSCodeFileSystemService";

export interface ReadmeSyncState {
  wikiIds: string[];
  backupPath?: string;
  readmePath?: string;
  updatedAt: number;
  changeSummary?: {
    added: number;
    updated: number;
    removed: number;
    preserved: number;
  };
}

export class ReadmeSyncTrackerService {
  private logger: Logger;
  private readonly stateFolder = ".qwiki/state";
  private readonly stateFile = "readme-sync.json";

  constructor(
    private fileSystem: VSCodeFileSystemService,
    private loggingService: LoggingService,
  ) {
    this.logger = createLogger("ReadmeSyncTrackerService");
  }

  async recordSync(state: ReadmeSyncState): Promise<void> {
    const filePath = this.getStateFilePath();
    if (!filePath) {
      this.logger.warn("Unable to record README sync state - workspace root unavailable");
      return;
    }

    try {
      await this.ensureStateFolder();
      const normalizedState: ReadmeSyncState = {
        ...state,
        wikiIds: [...state.wikiIds].sort(),
      };
      await this.fileSystem.writeFile(filePath, JSON.stringify(normalizedState), true);
      this.logger.debug("Recorded README sync state", {
        wikiCount: state.wikiIds.length,
        backupPath: state.backupPath,
      });
    } catch (error) {
      this.logger.error("Failed to record README sync state", error);
    }
  }

  async clear(): Promise<void> {
    const filePath = this.getStateFilePath();
    if (!filePath) {
      return;
    }

    try {
      const exists = await this.fileSystem.fileExists(filePath);
      if (exists) {
        await this.fileSystem.delete(filePath);
        this.logger.debug("Cleared README sync state");
      }
    } catch (error) {
      this.logger.warn("Failed to clear README sync state", error);
    }
  }

  async getState(): Promise<ReadmeSyncState | null> {
    const filePath = this.getStateFilePath();
    if (!filePath) {
      return null;
    }

    try {
      const exists = await this.fileSystem.fileExists(filePath);
      if (!exists) {
        return null;
      }

      const raw = await this.fileSystem.readFile(filePath, true);
      const parsed = JSON.parse(raw) as ReadmeSyncState;
      if (!parsed || !Array.isArray(parsed.wikiIds)) {
        return null;
      }
      return {
        ...parsed,
        wikiIds: [...parsed.wikiIds].sort(),
      };
    } catch (error) {
      this.logger.warn("Failed to read README sync state", error);
      return null;
    }
  }

  private getStateFilePath(): string | undefined {
    const workspaceRoot = this.getWorkspaceRoot();
    if (!workspaceRoot) {
      return undefined;
    }
    return join(workspaceRoot, this.stateFolder, this.stateFile);
  }

  private async ensureStateFolder(): Promise<void> {
    const workspaceRoot = this.getWorkspaceRoot();
    if (!workspaceRoot) {
      throw new Error("Workspace root not available");
    }
    const folderPath = join(workspaceRoot, this.stateFolder);
    const exists = await this.fileSystem.fileExists(folderPath);
    if (!exists) {
      await this.fileSystem.createDirectory(folderPath);
    }
  }

  private getWorkspaceRoot(): string | undefined {
    const workspaceFolders = workspace.workspaceFolders;
    return workspaceFolders?.[0]?.uri.fsPath;
  }
}
