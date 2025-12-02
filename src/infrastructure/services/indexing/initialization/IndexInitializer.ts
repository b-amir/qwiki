import type { ExtensionContext } from "vscode";
import type { Logger } from "@/infrastructure/services";
import type { IndexCacheService } from "@/infrastructure/services/indexing/IndexCacheService";

export class IndexInitializer {
  constructor(
    private cacheService: IndexCacheService,
    private logger: Logger,
  ) {}

  async quickInit(): Promise<boolean> {
    this.logger.debug("Starting quick initialization (cache only)");
    const startTime = Date.now();

    try {
      const cached = await this.cacheService.loadIndexFromCache();
      if (cached) {
        this.logger.info("Loaded index from cache", {
          fileCount: cached.files.length,
          ageMinutes: Math.round((Date.now() - cached.indexedAt) / 60000),
        });
        this.cacheService.restoreCache(cached);

        const duration = Date.now() - startTime;
        this.logger.info("Quick initialization complete", { duration });
        return true;
      } else {
        this.logger.debug("No valid cache found, quick init complete with empty index");

        const duration = Date.now() - startTime;
        this.logger.info("Quick initialization complete", { duration });
        return false;
      }
    } catch (error) {
      this.logger.warn("Quick initialization failed, continuing with empty index", error);
      return false;
    }
  }
}
