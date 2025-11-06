import { workspace } from "vscode";
import { join } from "path";
import { EventBus } from "../../events/EventBus";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "../../infrastructure/services/LoggingService";
import { VSCodeFileSystemService } from "../../infrastructure/services/VSCodeFileSystemService";

export class ReadmeBackupService {
  private logger: Logger;
  private readonly qwikiFolderName = ".qwiki";
  private readonly backupFileName = "README.backup.md";
  private hasBackup: boolean = false;

  constructor(
    private vscodeFileSystem: VSCodeFileSystemService,
    private loggingService: LoggingService,
    private eventBus?: EventBus,
  ) {
    this.logger = createLogger("ReadmeBackupService");
    this.initializeBackupState();
  }

  private async initializeBackupState(): Promise<void> {
    try {
      const backupPath = this.getBackupPath();
      if (backupPath) {
        this.hasBackup = await this.vscodeFileSystem.fileExists(backupPath);
      }
    } catch {
      this.hasBackup = false;
    }
  }

  async createBackup(readmeContent: string): Promise<string | undefined> {
    if (!readmeContent || readmeContent.trim().length === 0) {
      this.logger.debug("Skipping backup creation - README is empty or missing");
      return undefined;
    }

    const workspaceRoot = this.getWorkspaceRoot();
    if (!workspaceRoot) {
      throw new Error("No workspace root found");
    }

    const backupPath = this.getBackupPath();
    if (!backupPath) {
      throw new Error("Failed to determine backup path");
    }

    await this.ensureBackupFolder(workspaceRoot);

    if (this.hasBackup) {
      try {
        await this.vscodeFileSystem.delete(backupPath);
      } catch {
        this.logger.warn("Failed to delete existing backup, continuing");
      }
    }

    await this.vscodeFileSystem.writeFile(backupPath, readmeContent, true);
    this.hasBackup = true;

    if (this.eventBus) {
      this.eventBus.publish("readmeBackupCreated", { backupPath });
    }

    this.logger.info("README backup created", { backupPath });
    return backupPath;
  }

  async restoreFromBackup(
    writeReadme: (content: string) => Promise<void>,
  ): Promise<{ success: boolean; error?: string }> {
    const backupPath = this.getBackupPath();
    if (!backupPath || !this.hasBackup) {
      return {
        success: false,
        error: "No backup found to restore",
      };
    }

    try {
      const content = await this.vscodeFileSystem.readFile(backupPath, true);

      await writeReadme(content);

      await this.vscodeFileSystem.delete(backupPath);
      this.hasBackup = false;

      if (this.eventBus) {
        this.eventBus.publish("readmeBackupDeleted", {});
      }

      this.logger.info("README restored from backup");
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      this.logger.error("Failed to restore README from backup", error);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async deleteBackup(): Promise<void> {
    if (!this.hasBackup) {
      return;
    }

    const backupPath = this.getBackupPath();
    if (!backupPath) {
      return;
    }

    try {
      await this.vscodeFileSystem.delete(backupPath);
      this.hasBackup = false;

      if (this.eventBus) {
        this.eventBus.publish("readmeBackupDeleted", {});
      }

      this.logger.info("README backup deleted");
    } catch (error) {
      this.logger.warn("Failed to delete README backup", error);
    }
  }

  getBackupState(): boolean {
    return this.hasBackup;
  }

  private getBackupPath(): string | undefined {
    const workspaceRoot = this.getWorkspaceRoot();
    if (!workspaceRoot) {
      return undefined;
    }
    return join(workspaceRoot, this.qwikiFolderName, "backup", this.backupFileName);
  }

  private getWorkspaceRoot(): string | undefined {
    const workspaceFolders = workspace.workspaceFolders;
    return workspaceFolders?.[0]?.uri.fsPath;
  }

  private async ensureBackupFolder(workspaceRoot: string): Promise<void> {
    const qwikiFolderPath = join(workspaceRoot, this.qwikiFolderName);
    const backupFolderPath = join(qwikiFolderPath, "backup");

    if (!(await this.vscodeFileSystem.fileExists(qwikiFolderPath))) {
      await this.vscodeFileSystem.createDirectory(qwikiFolderPath);
    }

    if (!(await this.vscodeFileSystem.fileExists(backupFolderPath))) {
      await this.vscodeFileSystem.createDirectory(backupFolderPath);
    }
  }
}
