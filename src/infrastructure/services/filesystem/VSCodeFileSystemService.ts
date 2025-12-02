import { workspace, Uri, FileType } from "vscode";
import * as path from "path";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "@/infrastructure/services/logging/LoggingService";
import { CachingService } from "@/infrastructure/services/caching/CachingService";

interface FileStat {
  isFile: () => boolean;
  isDirectory: () => boolean;
  mtime?: number;
}

interface FileReadResult {
  filePath: string;
  content: string;
  error?: Error;
}

export class VSCodeFileSystemService {
  private logger: Logger;
  private statCache: CachingService;
  private readonly STAT_CACHE_TTL = 5000;

  constructor(private loggingService: LoggingService) {
    this.logger = createLogger("VSCodeFileSystemService");
    this.statCache = new CachingService({
      maxSize: 1000,
      defaultTtl: this.STAT_CACHE_TTL,
    });
  }

  async readFile(filePath: string, skipSanitization: boolean = false): Promise<string> {
    let sanitizedPath = filePath;

    if (!skipSanitization) {
      const { PathSanitizer } = await import("../../../utilities/pathSanitizer");
      const sanitizationResult = PathSanitizer.sanitizePath(filePath);
      if (!sanitizationResult.isValid) {
        throw new Error(`Invalid file path: ${sanitizationResult.warnings.join(", ")}`);
      }
      sanitizedPath = sanitizationResult.sanitized;
    }

    try {
      const uri = Uri.file(sanitizedPath);
      const bytes = await workspace.fs.readFile(uri);
      return Buffer.from(bytes).toString("utf-8");
    } catch (error) {
      this.logger.error(`Failed to read file ${sanitizedPath}`, error);
      throw new Error(`Failed to read file ${sanitizedPath}: ${error}`);
    }
  }

  async readFiles(filePaths: string[]): Promise<FileReadResult[]> {
    if (filePaths.length === 0) {
      return [];
    }

    const results = await Promise.allSettled(
      filePaths.map(async (filePath) => {
        try {
          const uri = Uri.file(filePath);
          const bytes = await workspace.fs.readFile(uri);
          const content = Buffer.from(bytes).toString("utf-8");
          return { filePath, content };
        } catch (error) {
          this.logger.error(`Failed to read file ${filePath}`, error);
          return {
            filePath,
            content: "",
            error: error instanceof Error ? error : new Error(String(error)),
          };
        }
      }),
    );

    return results.map((result, index) => {
      if (result.status === "fulfilled") {
        return result.value;
      } else {
        return {
          filePath: filePaths[index],
          content: "",
          error: result.reason instanceof Error ? result.reason : new Error(String(result.reason)),
        };
      }
    });
  }

  async writeFile(
    filePath: string,
    content: string,
    skipSanitization: boolean = false,
  ): Promise<void> {
    let sanitizedPath = filePath;

    if (!skipSanitization) {
      const { PathSanitizer } = await import("../../../utilities/pathSanitizer");
      const sanitizationResult = PathSanitizer.sanitizePath(filePath);
      if (!sanitizationResult.isValid) {
        throw new Error(`Invalid file path: ${sanitizationResult.warnings.join(", ")}`);
      }
      sanitizedPath = sanitizationResult.sanitized;
    }

    try {
      const uri = Uri.file(sanitizedPath);
      await workspace.fs.writeFile(uri, Buffer.from(content, "utf-8"));
      this.invalidateStatCache(sanitizedPath);
    } catch (error) {
      this.logger.error(`Failed to write file ${sanitizedPath}`, error);
      throw new Error(`Failed to write file ${sanitizedPath}: ${error}`);
    }
  }

  async fileExists(filePath: string): Promise<boolean> {
    try {
      await this.stat(filePath);
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

  async stat(filePath: string): Promise<FileStat> {
    const cacheKey = `stat:${filePath}`;
    const cached = await this.statCache.get<FileStat | null>(cacheKey);
    if (cached !== undefined) {
      if (cached === null) {
        throw new Error(`File does not exist: ${filePath}`);
      }
      return cached;
    }

    try {
      const uri = Uri.file(filePath);
      const statResult = await workspace.fs.stat(uri);
      const fileStat: FileStat = {
        isFile: () => statResult.type === FileType.File,
        isDirectory: () => statResult.type === FileType.Directory,
        mtime: statResult.mtime,
      };
      this.statCache.set(cacheKey, fileStat, { ttl: this.STAT_CACHE_TTL });
      return fileStat;
    } catch (error) {
      this.statCache.set(cacheKey, null, { ttl: this.STAT_CACHE_TTL });
      this.logger.debug(`File does not exist: ${filePath}`);
      throw new Error(`Failed to stat ${filePath}: ${error}`);
    }
  }

  async statFiles(filePaths: string[]): Promise<Map<string, FileStat>> {
    const results = new Map<string, FileStat>();
    const uncachedPaths: string[] = [];

    for (const filePath of filePaths) {
      const cacheKey = `stat:${filePath}`;
      const cached = await this.statCache.get<FileStat>(cacheKey);
      if (cached) {
        results.set(filePath, cached);
      } else {
        uncachedPaths.push(filePath);
      }
    }

    if (uncachedPaths.length > 0) {
      const statPromises = uncachedPaths.map(async (filePath) => {
        try {
          const uri = Uri.file(filePath);
          const stat = await workspace.fs.stat(uri);
          const fileStat: FileStat = {
            isFile: () => stat.type === FileType.File,
            isDirectory: () => stat.type === FileType.Directory,
            mtime: stat.mtime,
          };
          const cacheKey = `stat:${filePath}`;
          this.statCache.set(cacheKey, fileStat, { ttl: this.STAT_CACHE_TTL });
          return { filePath, stat: fileStat };
        } catch (error) {
          this.logger.error(`Failed to stat ${filePath}`, error);
          return { filePath, stat: null };
        }
      });

      const statResults = await Promise.all(statPromises);
      for (const { filePath, stat } of statResults) {
        if (stat) {
          results.set(filePath, stat);
        }
      }
    }

    return results;
  }

  invalidateStatCache(filePath?: string): void {
    if (filePath) {
      const cacheKey = `stat:${filePath}`;
      this.statCache.delete(cacheKey);
    } else {
      this.statCache.clear();
    }
  }

  async delete(filePath: string): Promise<void> {
    try {
      const uri = Uri.file(filePath);
      await workspace.fs.delete(uri, { recursive: false });
      this.invalidateStatCache(filePath);
    } catch (error) {
      this.logger.error(`Failed to delete file ${filePath}`, error);
      throw new Error(`Failed to delete file ${filePath}: ${error}`);
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
