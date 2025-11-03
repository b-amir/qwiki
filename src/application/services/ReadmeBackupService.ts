import { workspace, Uri } from "vscode";
import { join } from "path";
import { EventBus } from "../../events/EventBus";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "../../infrastructure/services/LoggingService";

export class ReadmeBackupService {
  private logger: Logger;
  private readonly qwikiFolderName = ".qwiki";
  private readonly backupFileName = "README.backup.md";
  private hasBackup: boolean = false;

  constructor(
    private loggingService: LoggingService,
    private eventBus?: EventBus,
  ) {
    this.logger = createLogger("ReadmeBackupService", loggingService);
    this.initializeBackupState();
  }

  private async initializeBackupState(): Promise<void> {
    try {
      const backupPath = this.getBackupPath();
      if (backupPath) {
        const backupUri = Uri.file(backupPath);
        try {
          await workspace.fs.stat(backupUri);
          this.hasBackup = true;
        } catch {
          this.hasBackup = false;
        }
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

    const backupUri = Uri.file(backupPath);

    if (this.hasBackup) {
      try {
        await workspace.fs.delete(backupUri);
      } catch {
        this.logger.warn("Failed to delete existing backup, continuing");
      }
    }

    await workspace.fs.writeFile(backupUri, Buffer.from(readmeContent, "utf8"));
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
      const backupUri = Uri.file(backupPath);
      const backupContent = await workspace.fs.readFile(backupUri);
      const content = Buffer.from(backupContent).toString("utf8");

      await writeReadme(content);

      await workspace.fs.delete(backupUri);
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
      const backupUri = Uri.file(backupPath);
      await workspace.fs.delete(backupUri);
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
    const qwikiFolderUri = Uri.file(qwikiFolderPath);
    const backupFolderUri = Uri.file(backupFolderPath);

    try {
      await workspace.fs.stat(qwikiFolderUri);
    } catch {
      await workspace.fs.createDirectory(qwikiFolderUri);
    }

    try {
      await workspace.fs.stat(backupFolderUri);
    } catch {
      await workspace.fs.createDirectory(backupFolderUri);
    }
  }
}
