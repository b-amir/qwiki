import { workspace, Uri } from "vscode";
import type { IndexedFile, ProjectIndexCache } from "../ProjectIndexService";
import { ServiceLimits } from "../../../constants/ServiceLimits";
import { LoggingService, createLogger, type Logger } from "../LoggingService";

export class IndexCacheService {
  private logger: Logger;
  private index = new Map<string, IndexedFile>();
  private languageIndex = new Map<string, Set<string>>();

  constructor(
    private extensionContext: any,
    private loggingService: LoggingService,
  ) {
    this.logger = createLogger("IndexCacheService", loggingService);
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
      cached.languageIndex.map(([lang, paths]) => [lang, new Set(paths)]),
    );
  }

  async persistIndex(): Promise<void> {
    try {
      const cacheData: ProjectIndexCache = {
        version: ServiceLimits.indexCacheVersion,
        indexedAt: Date.now(),
        files: Array.from(this.index.entries()),
        languageIndex: Array.from(this.languageIndex.entries()).map(([lang, paths]) => [
          lang,
          Array.from(paths),
        ]),
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
}
