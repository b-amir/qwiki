import * as vscode from "vscode";
import * as crypto from "crypto";
import * as fs from "fs/promises";
import * as path from "path";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "@/infrastructure/services/logging/LoggingService";
import type { TaskSchedulerService } from "@/infrastructure/services/orchestration/TaskSchedulerService";
import { TaskPriority } from "@/infrastructure/services/orchestration/TaskSchedulerService";

export interface FileContextCache {
  hash: string;
  symbols: string[];
  imports: string[];
  lastAnalyzed: number;
}

export interface ProjectCache {
  files: Record<string, FileContextCache>;
  version: string;
  lastUpdated: number;
}

export interface ContextCacheStatistics {
  totalEntries: number;
  hitCount: number;
  missCount: number;
  hitRate: number;
  oldestEntry: number;
  newestEntry: number;
}

export class ContextCacheService {
  private cache: ProjectCache = {
    files: {},
    version: "1.0.0",
    lastUpdated: Date.now(),
  };
  private cacheFilePath: string;
  private fileWatcher?: vscode.FileSystemWatcher;
  private logger: Logger;
  private saveDebounceTimer?: NodeJS.Timeout;
  private hitCount = 0;
  private missCount = 0;

  constructor(
    private context: vscode.ExtensionContext,
    private loggingService: LoggingService,
    private taskScheduler: TaskSchedulerService,
  ) {
    this.logger = createLogger("ContextCacheService");
    this.cacheFilePath = path.join(context.globalStorageUri.fsPath, "context-cache.json");
  }

  async initialize(): Promise<void> {
    await this.loadCache();
    this.setupFileWatcher();
    this.scheduleBackgroundWarming();
  }

  private async loadCache(): Promise<void> {
    try {
      const data = await fs.readFile(this.cacheFilePath, "utf-8");
      this.cache = JSON.parse(data);
      this.logger.info(`Loaded context cache with ${Object.keys(this.cache.files).length} files`);
    } catch (error) {
      this.logger.info("No existing cache found, starting fresh");
      this.cache = {
        files: {},
        version: "1.0.0",
        lastUpdated: Date.now(),
      };
    }
  }

  private async saveCache(): Promise<void> {
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
    }

    this.saveDebounceTimer = setTimeout(async () => {
      try {
        await fs.mkdir(path.dirname(this.cacheFilePath), { recursive: true });
        await fs.writeFile(this.cacheFilePath, JSON.stringify(this.cache, null, 2));
        this.logger.debug("Context cache saved to disk");
      } catch (error) {
        this.logger.error("Failed to save context cache", error);
      }
    }, 1000);
  }

  private setupFileWatcher(): void {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return;

    this.fileWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(workspaceFolder, "**/*.{ts,tsx,js,jsx,py,java,go,rs}"),
    );

    this.fileWatcher.onDidChange((uri) => this.invalidateFile(uri.fsPath));
    this.fileWatcher.onDidDelete((uri) => this.removeFile(uri.fsPath));
    this.fileWatcher.onDidCreate((uri) => this.scheduleFileAnalysis(uri.fsPath));
  }

  private invalidateFile(filePath: string): void {
    if (this.cache.files[filePath]) {
      delete this.cache.files[filePath];
      this.logger.debug(`Invalidated cache for ${filePath}`);
      this.saveCache();
    }
  }

  private removeFile(filePath: string): void {
    if (this.cache.files[filePath]) {
      delete this.cache.files[filePath];
      this.logger.debug(`Removed ${filePath} from cache`);
      this.saveCache();
    }
  }

  private scheduleFileAnalysis(filePath: string): void {
    this.taskScheduler.schedule({
      id: `analyze-${filePath}`,
      priority: TaskPriority.LOW,
      execute: async () => {
        await this.analyzeFile(filePath);
      },
      estimatedDuration: 50,
    });
  }

  async getFileContext(filePath: string): Promise<FileContextCache | null> {
    const cached = this.cache.files[filePath];
    if (cached) {
      const currentHash = await this.getFileHash(filePath);
      if (currentHash === cached.hash) {
        this.hitCount++;
        return cached;
      }
    }

    this.missCount++;
    return this.analyzeFile(filePath);
  }

  getStatistics(): ContextCacheStatistics {
    const entries = Object.values(this.cache.files);
    const totalRequests = this.hitCount + this.missCount;

    return {
      totalEntries: entries.length,
      hitCount: this.hitCount,
      missCount: this.missCount,
      hitRate: totalRequests > 0 ? this.hitCount / totalRequests : 0,
      oldestEntry:
        entries.length > 0 ? Math.min(...entries.map((e) => e.lastAnalyzed)) : Date.now(),
      newestEntry:
        entries.length > 0 ? Math.max(...entries.map((e) => e.lastAnalyzed)) : Date.now(),
    };
  }

  private async analyzeFile(filePath: string): Promise<FileContextCache | null> {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      const hash = this.computeHash(content);

      const symbols = this.extractSymbols(content);
      const imports = this.extractImports(content);

      const context: FileContextCache = {
        hash,
        symbols,
        imports,
        lastAnalyzed: Date.now(),
      };

      this.cache.files[filePath] = context;
      this.saveCache();

      return context;
    } catch (error) {
      this.logger.error(`Failed to analyze ${filePath}`, error);
      return null;
    }
  }

  private computeHash(content: string): string {
    return crypto.createHash("sha256").update(content).digest("hex");
  }

  private async getFileHash(filePath: string): Promise<string> {
    const content = await fs.readFile(filePath, "utf-8");
    return this.computeHash(content);
  }

  private extractSymbols(content: string): string[] {
    const symbols: string[] = [];
    const functionRegex = /(?:function|const|let|var)\s+(\w+)/g;
    const classRegex = /class\s+(\w+)/g;

    let match;
    while ((match = functionRegex.exec(content)) !== null) {
      symbols.push(match[1]);
    }
    while ((match = classRegex.exec(content)) !== null) {
      symbols.push(match[1]);
    }

    return symbols;
  }

  private extractImports(content: string): string[] {
    const imports: string[] = [];
    const importRegex = /import\s+.*?from\s+['"](.+?)['"]/g;

    let match;
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    return imports;
  }

  private scheduleBackgroundWarming(): void {
    this.taskScheduler.schedule({
      id: "background-cache-warming",
      priority: TaskPriority.IDLE,
      execute: async () => {
        await this.warmCache();
      },
      estimatedDuration: 2000,
    });
  }

  private async warmCache(): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return;

    const files = await vscode.workspace.findFiles(
      new vscode.RelativePattern(workspaceFolder, "**/*.{ts,tsx,js,jsx}"),
      "**/node_modules/**",
      100,
    );

    this.logger.info(`Warming cache for ${files.length} files`);

    for (const file of files) {
      this.scheduleFileAnalysis(file.fsPath);
    }
  }

  dispose(): void {
    if (this.fileWatcher) {
      this.fileWatcher.dispose();
    }
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
    }
  }
}
