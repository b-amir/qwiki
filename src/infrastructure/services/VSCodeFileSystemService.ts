import { workspace, Uri, FileType } from "vscode";
import * as path from "path";
import { LoggingService, createLogger, type Logger } from "./LoggingService";

export class VSCodeFileSystemService {
  private logger: Logger;

  constructor(private loggingService: LoggingService) {
    this.logger = createLogger("VSCodeFileSystemService", loggingService);
  }

  async readFile(filePath: string): Promise<string> {
    try {
      const uri = Uri.file(filePath);
      const bytes = await workspace.fs.readFile(uri);
      return Buffer.from(bytes).toString("utf-8");
    } catch (error) {
      this.logger.error(`Failed to read file ${filePath}`, error);
      throw new Error(`Failed to read file ${filePath}: ${error}`);
    }
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    try {
      const uri = Uri.file(filePath);
      await workspace.fs.writeFile(uri, Buffer.from(content, "utf-8"));
    } catch (error) {
      this.logger.error(`Failed to write file ${filePath}`, error);
      throw new Error(`Failed to write file ${filePath}: ${error}`);
    }
  }

  async fileExists(filePath: string): Promise<boolean> {
    try {
      const uri = Uri.file(filePath);
      await workspace.fs.stat(uri);
      return true;
    } catch {
      return false;
    }
  }

  async createDirectory(dirPath: string): Promise<void> {
    try {
      const uri = Uri.file(dirPath);
      await workspace.fs.createDirectory(uri);
    } catch (error) {
      this.logger.error(`Failed to create directory ${dirPath}`, error);
      throw new Error(`Failed to create directory ${dirPath}: ${error}`);
    }
  }

  async readDirectory(dirPath: string): Promise<[string, FileType][]> {
    try {
      const uri = Uri.file(dirPath);
      return await workspace.fs.readDirectory(uri);
    } catch (error) {
      this.logger.error(`Failed to read directory ${dirPath}`, error);
      throw new Error(`Failed to read directory ${dirPath}: ${error}`);
    }
  }

  async stat(filePath: string): Promise<{ isFile: () => boolean; isDirectory: () => boolean }> {
    try {
      const uri = Uri.file(filePath);
      const stat = await workspace.fs.stat(uri);
      return {
        isFile: () => stat.type === FileType.File,
        isDirectory: () => stat.type === FileType.Directory,
      };
    } catch (error) {
      this.logger.error(`Failed to stat ${filePath}`, error);
      throw new Error(`Failed to stat ${filePath}: ${error}`);
    }
  }

  async watchDirectory(
    directory: string,
    callback: (eventType: string, filename: string | null) => void,
  ): Promise<{ close: () => void }> {
    const exists = await this.fileExists(directory);
    if (!exists) {
      throw new Error(`Directory does not exist: ${directory}`);
    }

    const pattern = path.posix.join(directory.replace(/\\/g, "/"), "**/*");
    const watcher = workspace.createFileSystemWatcher(pattern);

    watcher.onDidCreate((fileUri) => {
      const relativePath = path.relative(directory, fileUri.fsPath);
      callback("rename", relativePath);
    });

    watcher.onDidChange((fileUri) => {
      const relativePath = path.relative(directory, fileUri.fsPath);
      callback("change", relativePath);
    });

    watcher.onDidDelete((fileUri) => {
      const relativePath = path.relative(directory, fileUri.fsPath);
      callback("rename", relativePath);
    });

    return {
      close: () => {
        watcher.dispose();
      },
    };
  }
}
