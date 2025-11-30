import type { Command } from "@/application/commands/Command";
import type {
  ReadmeUpdateService,
  ReadmeStatus,
} from "@/application/services/readme/ReadmeUpdateService";
import type { MessageBusService } from "@/application/services/core/MessageBusService";
import type { WikiStorageService } from "@/application/services/storage/WikiStorageService";
import type { EventBus } from "@/events/EventBus";
import { LoggingService, createLogger, type Logger } from "@/infrastructure/services";

export class CheckReadmeBackupCommand implements Command<void> {
  private logger: Logger;
  private cache: { state: ReadmeStatus | null; timestamp: number } | null = null;
  private readonly CACHE_TTL = 2000;
  private unsubscribeHandlers: Array<() => void> = [];

  constructor(
    private readmeUpdateService: ReadmeUpdateService,
    private wikiStorageService: WikiStorageService,
    private messageBus: MessageBusService,
    private loggingService: LoggingService,
    private eventBus?: EventBus,
  ) {
    this.logger = createLogger("CheckReadmeBackupCommand");
    this.setupEventSubscriptions();
  }

  private setupEventSubscriptions(): void {
    if (!this.eventBus) return;

    const unsub1 = this.eventBus.subscribe("readmeBackupCreated", () => {
      this.invalidateCache();
    });
    const unsub2 = this.eventBus.subscribe("readmeBackupDeleted", () => {
      this.invalidateCache();
    });
    const unsub3 = this.eventBus.subscribe("readmeUpdated", () => {
      this.invalidateCache();
    });

    this.unsubscribeHandlers = [unsub1, unsub2, unsub3];
  }

  invalidateCache(): void {
    this.cache = null;
    this.logger.debug("Cache invalidated");
  }

  async execute(): Promise<void> {
    const startTime = Date.now();
    try {
      const now = Date.now();
      if (this.cache && now - this.cache.timestamp < this.CACHE_TTL) {
        const age = now - this.cache.timestamp;
        this.logger.debug("README backup state cache hit", {
          age,
          ttl: this.CACHE_TTL,
          hasBackup: this.cache.state?.hasBackup ?? false,
          readmeSynced: this.cache.state?.isSynced ?? false,
        });
        await this.messageBus.postMessage("readmeBackupState", {
          hasBackup: this.cache.state?.hasBackup ?? false,
          readmeStatus: this.cache.state,
        });
        return;
      }

      this.logger.debug("Checking README backup state", {
        cacheHit: false,
        cacheAge: this.cache ? now - this.cache.timestamp : null,
      });

      const wikis = await this.wikiStorageService.getAllSavedWikis();
      const readmeStatus: ReadmeStatus = await this.readmeUpdateService.getReadmeStatus(
        wikis.map((wiki) => wiki.id),
      );

      this.cache = {
        state: readmeStatus,
        timestamp: now,
      };

      await this.messageBus.postMessage("readmeBackupState", {
        hasBackup: readmeStatus.hasBackup,
        readmeStatus,
      });

      const duration = Date.now() - startTime;
      this.logger.debug("README backup state checked", {
        duration,
        hasBackup: readmeStatus.hasBackup,
        readmeSynced: readmeStatus.isSynced,
        cached: true,
        ttl: this.CACHE_TTL,
      });
    } catch (error) {
      this.logger.error("Failed to check README backup state", error);
    }
  }

  dispose(): void {
    this.unsubscribeHandlers.forEach((unsub) => unsub());
    this.unsubscribeHandlers = [];
  }
}
