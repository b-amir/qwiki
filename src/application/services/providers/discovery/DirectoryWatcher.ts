import type { EventBus } from "@/events/EventBus";
import type { Logger } from "@/infrastructure/services";
import type { ProviderFileSystemService } from "@/infrastructure/services/providers/ProviderFileSystemService";
import type { VSCodeFileSystemService } from "@/infrastructure/services/filesystem/VSCodeFileSystemService";

export class DirectoryWatcher {
  private watchers: { close: () => void }[] = [];

  constructor(
    private eventBus: EventBus,
    private providerFileSystemService: ProviderFileSystemService,
    private vscodeFileSystem: VSCodeFileSystemService,
    private logger: Logger,
  ) {}

  async startWatching(directories: string[]): Promise<void> {
    this.logger.debug(`Starting to watch ${directories.length} directories for changes`);
    this.stopWatching();

    for (const directory of directories) {
      const exists = await this.vscodeFileSystem.fileExists(directory);
      if (exists) {
        this.logger.debug(`Setting up watcher for directory ${directory}`);

        try {
          const watcher = await this.providerFileSystemService.watchProviderDirectory(
            directory,
            (change) => {
              if (change.filename.endsWith("manifest.json")) {
                this.logger.debug(
                  `Manifest file ${change.filename} changed in ${directory} (${change.eventType})`,
                );
                this.eventBus.publish("provider-manifest-changed", {
                  directory,
                  filename: change.filename,
                  eventType: change.eventType,
                });
              }
            },
          );

          this.watchers.push(watcher);
          this.logger.debug(`Watcher established for directory ${directory}`);
        } catch (error) {
          this.logger.error(`Failed to set up watcher for directory ${directory}:`, error);
        }
      } else {
        this.logger.warn(`Directory ${directory} does not exist, cannot set up watcher`);
      }
    }

    this.logger.debug(`Watching set up with ${this.watchers.length} active watchers`);
  }

  stopWatching(): void {
    this.logger.debug(`Stopping ${this.watchers.length} directory watchers`);

    try {
      for (const watcher of this.watchers) {
        watcher.close();
      }
      this.watchers = [];
      this.logger.debug(`All directory watchers stopped`);
    } catch (error) {
      this.logger.error(`Error stopping directory watchers:`, error);
    }
  }
}
