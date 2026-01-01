import type { ExtensionContext } from "vscode";
import type { Logger } from "@/infrastructure/services";
import type { IndexCacheService } from "@/infrastructure/services/indexing/IndexCacheService";

export interface QuickInitResult {
  success: boolean;
  needsBackgroundRefresh: boolean;
  cacheStatus: "fresh" | "stale" | "expired";
}

export class IndexInitializer {
  constructor(
    private cacheService: IndexCacheService,
    private logger: Logger,
  ) {}

  async quickInit(): Promise<QuickInitResult> {
    this.logger.debug("Starting quick initialization (cache only)");
    const startTime = Date.now();

    try {
      const { cache, status, needsRefresh } = await this.cacheService.loadIndexWithRevalidation();

      if (cache) {
        this.cacheService.restoreCache(cache);
        const duration = Date.now() - startTime;

        if (status === "stale") {
          this.logger.info("Loaded stale cache, background refresh scheduled", {
            fileCount: cache.files.length,
            ageMinutes: Math.round((Date.now() - cache.indexedAt) / 60000),
            duration,
          });
        } else {
          this.logger.info("Loaded fresh cache", {
            fileCount: cache.files.length,
            duration,
          });
        }

        return {
          success: true,
          needsBackgroundRefresh: needsRefresh,
          cacheStatus: status,
        };
      }

      this.logger.debug("No valid cache found, quick init complete with empty index");
      const duration = Date.now() - startTime;
      this.logger.info("Quick initialization complete", { duration });

      return {
        success: false,
        needsBackgroundRefresh: true,
        cacheStatus: "expired",
      };
    } catch (error) {
      this.logger.warn("Quick initialization failed, continuing with empty index", error);
      return {
        success: false,
        needsBackgroundRefresh: true,
        cacheStatus: "expired",
      };
    }
  }
}
