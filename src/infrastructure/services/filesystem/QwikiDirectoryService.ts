import { workspace, Uri } from "vscode";
import * as path from "path";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "@/infrastructure/services/logging/LoggingService";

export class QwikiDirectoryService {
  private logger: Logger;
  private initialized = false;
  private workspaceRoot: string | undefined;

  private readonly QWIKI_DIR = ".qwiki";
  private readonly SUBDIRS = ["saved", "cache"];

  constructor(private loggingService: LoggingService) {
    this.logger = createLogger("QwikiDirectoryService");
  }

  async ensureDirectoriesExist(): Promise<void> {
    if (this.initialized) {
      return;
    }

    const workspaceFolders = workspace.workspaceFolders;
    if (!workspaceFolders?.length) {
      this.logger.debug("No workspace folders found");
      return;
    }

    this.workspaceRoot = workspaceFolders[0]!.uri.fsPath;
    const qwikiPath = path.join(this.workspaceRoot, this.QWIKI_DIR);

    await this.ensureDir(qwikiPath);

    for (const subdir of this.SUBDIRS) {
      await this.ensureDir(path.join(qwikiPath, subdir));
    }

    this.initialized = true;
    this.logger.info("Qwiki directories verified", {
      path: qwikiPath,
      subdirs: this.SUBDIRS,
    });
  }

  private async ensureDir(dirPath: string): Promise<void> {
    try {
      await workspace.fs.stat(Uri.file(dirPath));
    } catch {
      try {
        await workspace.fs.createDirectory(Uri.file(dirPath));
        this.logger.debug(`Created directory: ${dirPath}`);
      } catch (error) {
        this.logger.error(`Failed to create directory: ${dirPath}`, error);
        throw error;
      }
    }
  }

  getQwikiPath(): string {
    if (!this.workspaceRoot) {
      const workspaceFolders = workspace.workspaceFolders;
      if (!workspaceFolders?.length) {
        throw new Error("QwikiDirectoryService: No workspace folder found");
      }
      return path.join(workspaceFolders[0]!.uri.fsPath, this.QWIKI_DIR);
    }
    return path.join(this.workspaceRoot, this.QWIKI_DIR);
  }

  getSavedWikisPath(): string {
    return path.join(this.getQwikiPath(), "saved");
  }

  getCachePath(): string {
    return path.join(this.getQwikiPath(), "cache");
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}
