import { workspace, Uri, type ExtensionContext } from "vscode";
import type {
  IndexedFile,
  ProjectIndexCache,
} from "@/infrastructure/services/indexing/ProjectIndexService";
import { ServiceLimits } from "@/constants";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "@/infrastructure/services/logging/LoggingService";
import type { FileRelevanceScore } from "@/domain/entities/ContextIntelligence";
import { VSCodeFileSystemService } from "@/infrastructure/services/filesystem/VSCodeFileSystemService";
import type { DocumentSymbol } from "vscode";

interface CachedRelevanceScores {
  targetFilePath: string;
  scores: FileRelevanceScore[];
  fileHashes: Map<string, string>;
  cachedAt: number;
  expiresAt: number;
}

export class IndexCacheService {
  private logger: Logger;
  private index = new Map<string, IndexedFile>();
  private languageIndex = new Map<string, Set<string>>();
  private fileSystemService: VSCodeFileSystemService;

  constructor(
    private extensionContext: ExtensionContext,
    private loggingService: LoggingService,
  ) {
    this.logger = createLogger("IndexCacheService");
    this.fileSystemService = new VSCodeFileSystemService(loggingService);
  }

  getCacheStatus(): "fresh" | "stale" | "expired" {
    try {
      const cached = this.extensionContext.workspaceState.get("projectIndexCache") as
        | ProjectIndexCache
        | undefined;

      if (!cached || cached.version !== ServiceLimits.indexCacheVersion) {
        return "expired";
      }

      const age = Date.now() - cached.indexedAt;

      if (age < ServiceLimits.indexCacheFreshTTL) {
        return "fresh";
      }
      if (age < ServiceLimits.indexCacheStaleTTL) {
        return "stale";
      }
      return "expired";
    } catch {
      return "expired";
    }
  }

  async loadIndexWithRevalidation(): Promise<{
    cache: ProjectIndexCache | null;
    status: "fresh" | "stale" | "expired";
    needsRefresh: boolean;
  }> {
    const status = this.getCacheStatus();
    const cached = await this.loadIndexFromCacheRaw();

    if (status === "expired") {
      return { cache: null, status, needsRefresh: true };
    }

    if (status === "stale") {
      return { cache: cached, status, needsRefresh: true };
    }

    return { cache: cached, status, needsRefresh: false };
  }

  private async loadIndexFromCacheRaw(): Promise<ProjectIndexCache | null> {
    try {
      const cached = this.extensionContext.workspaceState.get("projectIndexCache") as
        | ProjectIndexCache
        | undefined;

      if (!cached || cached.version !== ServiceLimits.indexCacheVersion) {
        return null;
      }

      return cached;
    } catch (error) {
      this.logger.debug("Failed to load index from cache", error);
      return null;
    }
  }

  async loadIndexFromCache(): Promise<ProjectIndexCache | null> {
    try {
      const cached = this.extensionContext.workspaceState.get("projectIndexCache") as
        | ProjectIndexCache
        | undefined;

      if (!cached || cached.version !== ServiceLimits.indexCacheVersion) {
        return null;
      }

      const cacheAge = Date.now() - cached.indexedAt;
      if (cacheAge > ServiceLimits.indexCacheTTL) {
        this.logger.debug("Cache expired", { ageMs: cacheAge });
        return null;
      }

      return cached;
    } catch (error) {
      this.logger.debug("Failed to load index from cache", error);
      return null;
    }
  }

  restoreCache(cached: ProjectIndexCache): void {
    this.index = new Map(cached.files);
    this.languageIndex = new Map(
      cached.languageIndex.map(([lang, paths]: [string, string[]]) => [lang, new Set(paths)]),
    );
  }

  async persistIndex(): Promise<void> {
    try {
      const cacheData: ProjectIndexCache = {
        version: ServiceLimits.indexCacheVersion,
        indexedAt: Date.now(),
        files: Array.from(this.index.entries()),
        languageIndex: Array.from(this.languageIndex.entries()).map(
          ([lang, paths]: [string, Set<string>]) => [lang, Array.from(paths)],
        ),
      };

      await this.extensionContext.workspaceState.update("projectIndexCache", cacheData);
      this.logger.debug("Index persisted to cache", { fileCount: this.index.size });
    } catch (error) {
      this.logger.debug("Failed to persist index", error);
    }
  }

  getIndex(): Map<string, IndexedFile> {
    return this.index;
  }

  getLanguageIndex(): Map<string, Set<string>> {
    return this.languageIndex;
  }

  updateLanguageIndexForFile(filePath: string, language: string | undefined): void {
    for (const [lang, paths] of this.languageIndex.entries()) {
      paths.delete(filePath);
      if (paths.size === 0) {
        this.languageIndex.delete(lang);
      }
    }

    if (language) {
      let paths = this.languageIndex.get(language);
      if (!paths) {
        paths = new Set();
        this.languageIndex.set(language, paths);
      }
      paths.add(filePath);
    }
  }

  async setRelevanceScores(targetFilePath: string, scores: FileRelevanceScore[]): Promise<void> {
    try {
      const fileHashes = new Map<string, string>();

      for (const score of scores) {
        try {
          const hash = await this.getFileHash(score.filePath);
          fileHashes.set(score.filePath, hash);
        } catch (error) {
          this.logger.debug(`Failed to get hash for ${score.filePath}`, error);
        }
      }

      const cached: Omit<CachedRelevanceScores, "fileHashes"> & {
        fileHashes: Array<[string, string]>;
      } = {
        targetFilePath,
        scores,
        fileHashes: Array.from(fileHashes.entries()),
        cachedAt: Date.now(),
        expiresAt: Date.now() + ServiceLimits.contextIntelligenceFileRelevanceTTL,
      };

      const key = `index:relevance:${targetFilePath}`;
      await this.extensionContext.workspaceState.update(key, cached);

      this.logger.debug("Relevance scores cached", {
        targetFilePath,
        scoreCount: scores.length,
      });
    } catch (error) {
      this.logger.error("Failed to cache relevance scores", { error, targetFilePath });
    }
  }

  async getRelevanceScores(targetFilePath: string): Promise<FileRelevanceScore[] | null> {
    try {
      const key = `index:relevance:${targetFilePath}`;
      const cached = this.extensionContext.workspaceState.get(key) as
        | (Omit<CachedRelevanceScores, "fileHashes"> & { fileHashes: Array<[string, string]> })
        | undefined;

      if (!cached) {
        return null;
      }

      const now = Date.now();
      if (now > cached.expiresAt) {
        this.logger.debug("Relevance scores cache expired", {
          targetFilePath,
          age: now - cached.cachedAt,
        });
        await this.extensionContext.workspaceState.update(key, undefined);
        return null;
      }

      return cached.scores;
    } catch (error) {
      this.logger.error("Failed to get relevance scores from cache", { error, targetFilePath });
      return null;
    }
  }

  async validateRelevanceScores(
    scores: FileRelevanceScore[],
    files: Uri[],
    targetFilePath: string,
  ): Promise<FileRelevanceScore[]> {
    const validScores: FileRelevanceScore[] = [];
    const filePathSet = new Set(files.map((f) => f.fsPath));

    const cachedData = await this.getCachedRelevanceData(targetFilePath);
    if (!cachedData) {
      return [];
    }

    for (const score of scores) {
      if (!filePathSet.has(score.filePath)) {
        continue;
      }

      try {
        const currentHash = await this.getFileHash(score.filePath);
        const cachedHash = cachedData.fileHashes.get(score.filePath);

        if (!cachedHash || currentHash === cachedHash) {
          validScores.push(score);
        } else {
          this.logger.debug("Relevance score invalidated due to file change", {
            filePath: score.filePath,
          });
        }
      } catch (error) {
        this.logger.debug(`Failed to validate score for ${score.filePath}`, error);
      }
    }

    return validScores;
  }

  private async getFileHash(filePath: string): Promise<string> {
    try {
      const content = await this.fileSystemService.readFile(filePath, true);
      return this.simpleHash(content);
    } catch (error) {
      this.logger.debug(`Failed to read file for hash: ${filePath}`, error);
      return "";
    }
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  private async getCachedRelevanceData(
    targetFilePath: string,
  ): Promise<{ fileHashes: Map<string, string> } | null> {
    try {
      const key = `index:relevance:${targetFilePath}`;
      const cached = this.extensionContext.workspaceState.get(key) as
        | (Omit<CachedRelevanceScores, "fileHashes"> & { fileHashes: Array<[string, string]> })
        | undefined;

      if (!cached) {
        return null;
      }

      return {
        fileHashes: new Map<string, string>(cached.fileHashes),
      };
    } catch {
      return null;
    }
  }

  async setSymbols(filePath: string, symbols: DocumentSymbol[]): Promise<void> {
    try {
      const fileHash = await this.getFileHash(filePath);
      const key = `index:symbols:${filePath}`;

      const existing = this.extensionContext.workspaceState.get(key) as
        | {
            filePath: string;
            symbols: DocumentSymbol[];
            fileHash: string;
            cachedAt: number;
            expiresAt: number;
          }
        | undefined;

      if (existing && existing.fileHash === fileHash) {
        if (existing.symbols.length !== symbols.length) {
          this.logger.debug("Symbol count mismatch detected, but file hash unchanged", {
            filePath,
            existingCount: existing.symbols.length,
            newCount: symbols.length,
            usingExisting: true,
          });
          return;
        }
      }

      const cached = {
        filePath,
        symbols,
        fileHash,
        cachedAt: Date.now(),
        expiresAt: Date.now() + 30 * 60 * 1000,
      };
      await this.extensionContext.workspaceState.update(key, cached);
      this.logger.debug("Symbols cached in index", { filePath, symbolCount: symbols.length });
    } catch (error) {
      this.logger.error("Failed to cache symbols in index", { error, filePath });
    }
  }

  async getSymbols(filePath: string): Promise<DocumentSymbol[] | null> {
    try {
      const key = `index:symbols:${filePath}`;
      const cached = this.extensionContext.workspaceState.get(key) as
        | {
            filePath: string;
            symbols: DocumentSymbol[];
            fileHash: string;
            cachedAt: number;
            expiresAt: number;
          }
        | undefined;

      if (!cached) {
        return null;
      }

      const now = Date.now();
      if (now > cached.expiresAt) {
        this.logger.debug("Symbol cache expired", { filePath, age: now - cached.cachedAt });
        await this.extensionContext.workspaceState.update(key, undefined);
        return null;
      }

      const currentHash = await this.getFileHash(filePath);
      if (currentHash !== cached.fileHash) {
        this.logger.debug("Symbol cache invalidated due to file change", { filePath });
        await this.extensionContext.workspaceState.update(key, undefined);
        return null;
      }

      return cached.symbols;
    } catch (error) {
      this.logger.error("Failed to get symbols from index cache", { error, filePath });
      return null;
    }
  }

  async removeStaleEntries(): Promise<{ removed: number; checked: number }> {
    const toRemove: string[] = [];
    let checked = 0;

    for (const [filePath] of this.index.entries()) {
      checked++;
      try {
        await this.fileSystemService.stat(filePath);
      } catch {
        toRemove.push(filePath);
      }
    }

    for (const filePath of toRemove) {
      this.index.delete(filePath);
      this.updateLanguageIndexForFile(filePath, undefined);
    }

    if (toRemove.length > 0) {
      await this.persistIndex();
      this.logger.info(`Cleaned ${toRemove.length} stale entries from ${checked} checked`);
    }

    return { removed: toRemove.length, checked };
  }

  removeFromIndex(filePath: string): void {
    if (this.index.has(filePath)) {
      this.index.delete(filePath);
      this.updateLanguageIndexForFile(filePath, undefined);
      this.logger.debug(`Removed file from index: ${filePath}`);
    }
  }
}
