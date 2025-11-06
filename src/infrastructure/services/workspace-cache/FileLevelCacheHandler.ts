import type { Memento } from "vscode";
import { ServiceLimits } from "../../../constants/ServiceLimits";
import { LoggingService, createLogger, type Logger } from "../LoggingService";
import type {
  FileRelevanceScore,
  DependencyMap,
} from "../../../domain/entities/ContextIntelligence";
import type {
  CachedFileRelevanceScores,
  CachedDependencyMap,
} from "../WorkspaceStructureCacheService";

export class FileLevelCacheHandler {
  private logger: Logger;
  private readonly FILE_RELEVANCE_BATCH_KEY = "qwiki:fileRelevanceBatch:";
  private readonly DEPENDENCY_MAP_KEY = "qwiki:dependencyMap:";

  constructor(
    private memento: Memento,
    private loggingService: LoggingService,
  ) {
    this.logger = createLogger("FileLevelCacheHandler");
  }

  async getFileRelevanceScores(targetFilePath: string): Promise<FileRelevanceScore[] | null> {
    try {
      const key = `${this.FILE_RELEVANCE_BATCH_KEY}${targetFilePath}`;
      const cached = this.memento.get<CachedFileRelevanceScores>(key);

      if (!cached) {
        return null;
      }

      const now = Date.now();
      if (now > cached.expiresAt) {
        this.logger.debug("File relevance scores cache expired", {
          targetFilePath,
          age: now - cached.cachedAt,
        });
        await this.deleteFileRelevanceScores(targetFilePath);
        return null;
      }

      this.logger.debug("File relevance scores cache hit", {
        targetFilePath,
        scoreCount: cached.scores.length,
      });

      return cached.scores;
    } catch (error) {
      this.logger.error("Error reading file relevance scores cache", { error });
      return null;
    }
  }

  async setFileRelevanceScores(
    targetFilePath: string,
    scores: FileRelevanceScore[],
    ttl: number = ServiceLimits.contextIntelligenceFileRelevanceTTL,
  ): Promise<void> {
    try {
      const now = Date.now();
      const cached: CachedFileRelevanceScores = {
        scores,
        cachedAt: now,
        expiresAt: now + ttl,
      };

      const key = `${this.FILE_RELEVANCE_BATCH_KEY}${targetFilePath}`;
      await this.memento.update(key, cached);

      this.logger.debug("File relevance scores cached", {
        targetFilePath,
        scoreCount: scores.length,
      });
    } catch (error) {
      this.logger.error("Error caching file relevance scores", { error });
    }
  }

  async deleteFileRelevanceScores(targetFilePath: string): Promise<void> {
    const key = `${this.FILE_RELEVANCE_BATCH_KEY}${targetFilePath}`;
    await this.memento.update(key, undefined);
  }

  async getDependencyMap(filePath: string): Promise<DependencyMap | null> {
    try {
      const key = `${this.DEPENDENCY_MAP_KEY}${filePath}`;
      const cached = this.memento.get<CachedDependencyMap>(key);

      if (!cached) {
        return null;
      }

      const now = Date.now();
      if (now > cached.expiresAt) {
        await this.deleteDependencyMap(filePath);
        return null;
      }

      this.logger.debug("Dependency map cache hit", { filePath });
      return cached.dependencyMap;
    } catch (error) {
      this.logger.error("Error reading dependency map cache", { error });
      return null;
    }
  }

  async setDependencyMap(
    filePath: string,
    dependencyMap: DependencyMap,
    ttl: number = ServiceLimits.contextIntelligenceFileRelevanceTTL,
  ): Promise<void> {
    try {
      const now = Date.now();
      const cached: CachedDependencyMap = {
        dependencyMap,
        cachedAt: now,
        expiresAt: now + ttl,
      };

      const key = `${this.DEPENDENCY_MAP_KEY}${filePath}`;
      await this.memento.update(key, cached);
    } catch (error) {
      this.logger.error("Error caching dependency map", { error });
    }
  }

  async deleteDependencyMap(filePath: string): Promise<void> {
    const key = `${this.DEPENDENCY_MAP_KEY}${filePath}`;
    await this.memento.update(key, undefined);
  }
}
