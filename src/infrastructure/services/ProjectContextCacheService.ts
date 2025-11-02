import type { ExtensionContext, Memento } from "vscode";
import type { ProjectContext } from "../../domain/entities/Selection";
import { ServiceLimits } from "../../constants/ServiceLimits";
import { LoggingService, createLogger, type Logger } from "./LoggingService";

export interface CachedProjectContextEntry {
  context: ProjectContext;
  cachedAt: number;
  expiresAt: number;
  metadata: ProjectContextCacheMetadata;
}

export interface ProjectContextCacheMetadata {
  workspaceRoot: string;
  packageJsonPath?: string;
  packageJsonModified?: number;
  fileCount: number;
  snippetHash: string;
  filePath?: string;
  languageId?: string;
}

export class ProjectContextCacheService {
  private logger: Logger;
  private memento: Memento;
  private readonly CACHE_KEY_PREFIX = "qwiki:projectContext:";
  private readonly METADATA_KEY_PREFIX = "qwiki:projectContextMetadata:";

  constructor(
    private extensionContext: ExtensionContext,
    private loggingService: LoggingService,
    useGlobalState: boolean = false,
  ) {
    this.logger = createLogger("ProjectContextCacheService", loggingService);
    this.memento = useGlobalState ? extensionContext.globalState : extensionContext.workspaceState;
  }

  async get(key: string): Promise<ProjectContext | null> {
    try {
      const entryKey = this.getEntryKey(key);
      const cached = this.memento.get<CachedProjectContextEntry>(entryKey);

      if (!cached) {
        this.logger.debug("Cache miss - no entry found", { key });
        return null;
      }

      const now = Date.now();
      if (now > cached.expiresAt) {
        this.logger.debug("Cache expired", {
          key,
          age: now - cached.cachedAt,
          ttl: cached.expiresAt - cached.cachedAt,
        });
        await this.delete(key);
        return null;
      }

      this.logger.debug("Cache hit", {
        key,
        age: now - cached.cachedAt,
        fileCount: cached.context.filesSample?.length || 0,
      });

      return cached.context;
    } catch (error) {
      this.logger.error("Error reading from persistent cache", { key, error });
      return null;
    }
  }

  async set(
    key: string,
    context: ProjectContext,
    metadata: ProjectContextCacheMetadata,
    ttl: number = ServiceLimits.projectContextCacheTTL,
  ): Promise<void> {
    try {
      const now = Date.now();
      const entry: CachedProjectContextEntry = {
        context,
        cachedAt: now,
        expiresAt: now + ttl,
        metadata,
      };

      const entryKey = this.getEntryKey(key);
      await this.memento.update(entryKey, entry);

      const metadataKey = this.getMetadataKey(key);
      await this.memento.update(metadataKey, metadata);

      this.logger.debug("Cache entry stored", {
        key,
        fileCount: context.filesSample?.length || 0,
        ttl,
      });
    } catch (error) {
      this.logger.error("Error writing to persistent cache", { key, error });
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const entryKey = this.getEntryKey(key);
      const metadataKey = this.getMetadataKey(key);
      await this.memento.update(entryKey, undefined);
      await this.memento.update(metadataKey, undefined);
      this.logger.debug("Cache entry deleted", { key });
    } catch (error) {
      this.logger.error("Error deleting from persistent cache", { key, error });
    }
  }

  async getMetadata(key: string): Promise<ProjectContextCacheMetadata | null> {
    try {
      const metadataKey = this.getMetadataKey(key);
      return this.memento.get<ProjectContextCacheMetadata>(metadataKey) || null;
    } catch (error) {
      this.logger.error("Error reading cache metadata", { key, error });
      return null;
    }
  }

  async clear(): Promise<void> {
    try {
      const allKeys = this.memento.keys();
      const keysToDelete = allKeys.filter(
        (key) => key.startsWith(this.CACHE_KEY_PREFIX) || key.startsWith(this.METADATA_KEY_PREFIX),
      );

      for (const key of keysToDelete) {
        await this.memento.update(key, undefined);
      }

      this.logger.info("Cache cleared", { deletedCount: keysToDelete.length });
    } catch (error) {
      this.logger.error("Error clearing cache", { error });
    }
  }

  async getAllKeys(): Promise<string[]> {
    try {
      const allKeys = this.memento.keys();
      return allKeys
        .filter((key) => key.startsWith(this.CACHE_KEY_PREFIX))
        .map((key) => key.replace(this.CACHE_KEY_PREFIX, ""));
    } catch (error) {
      this.logger.error("Error getting cache keys", { error });
      return [];
    }
  }

  private getEntryKey(key: string): string {
    return `${this.CACHE_KEY_PREFIX}${key}`;
  }

  private getMetadataKey(key: string): string {
    return `${this.METADATA_KEY_PREFIX}${key}`;
  }
}
