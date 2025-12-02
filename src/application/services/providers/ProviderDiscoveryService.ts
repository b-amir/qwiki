import * as path from "path";
import { FileType } from "vscode";
import { EventBus } from "@/events/EventBus";
import { ProviderMetadata, ProviderManifest } from "@/llm/types/ProviderMetadata";
import { LLMProvider } from "@/llm/types";
import { ProviderFileSystemService } from "@/infrastructure/services/providers/ProviderFileSystemService";
import { VSCodeFileSystemService } from "@/infrastructure/services/filesystem/VSCodeFileSystemService";
import { LoggingService, createLogger, type Logger } from "@/infrastructure/services";
import { ProviderManifestValidator } from "@/application/services/providers/discovery/ProviderManifestValidator";
import { ProviderLoader } from "@/application/services/providers/discovery/ProviderLoader";
import { DirectoryWatcher } from "@/application/services/providers/discovery/DirectoryWatcher";

export class ProviderDiscoveryService {
  private discoveredProviders = new Map<string, ProviderMetadata>();
  private logger: Logger;
  private manifestValidator: ProviderManifestValidator;
  private providerLoader: ProviderLoader;
  private directoryWatcher: DirectoryWatcher;

  constructor(
    private eventBus: EventBus,
    private providerFileSystemService: ProviderFileSystemService,
    private vscodeFileSystem: VSCodeFileSystemService,
    private loggingService: LoggingService = new LoggingService(),
  ) {
    this.logger = createLogger("ProviderDiscoveryService");
    this.manifestValidator = new ProviderManifestValidator();
    this.providerLoader = new ProviderLoader(this.logger);
    this.directoryWatcher = new DirectoryWatcher(
      this.eventBus,
      this.providerFileSystemService,
      this.vscodeFileSystem,
      this.logger,
    );
  }

  async discoverProviders(): Promise<ProviderMetadata[]> {
    const discoverStartTime = Date.now();
    this.logger.debug("Starting provider discovery");

    try {
      const providerDirs = await this.getProviderDirectories();
      this.logger.debug(`Found ${providerDirs.length} provider directories to scan`);

      const allProviders: ProviderMetadata[] = [];

      for (const dir of providerDirs) {
        const scanStartTime = Date.now();
        this.logger.debug(`Scanning directory ${dir}`);

        try {
          const providers = await this.scanDirectory(dir);
          allProviders.push(...providers);

          const scanEndTime = Date.now();
          this.logger.debug(
            `Directory ${dir} scanned in ${scanEndTime - scanStartTime}ms, found ${providers.length} providers`,
          );
        } catch (error) {
          const scanEndTime = Date.now();
          this.logger.error(
            `Failed to scan directory ${dir} after ${scanEndTime - scanStartTime}ms:`,
            error,
          );
        }
      }

      const discoverEndTime = Date.now();
      this.logger.debug(
        `Provider discovery completed in ${discoverEndTime - discoverStartTime}ms, found ${allProviders.length} total providers`,
      );

      return allProviders;
    } catch (error) {
      const discoverEndTime = Date.now();
      this.logger.error(
        `Provider discovery failed after ${discoverEndTime - discoverStartTime}ms:`,
        error,
      );
      throw error;
    }
  }

  async scanDirectory(directoryPath: string): Promise<ProviderMetadata[]> {
    const scanStartTime = Date.now();
    this.logger.debug(`Scanning directory ${directoryPath}`);

    try {
      const exists = await this.vscodeFileSystem.fileExists(directoryPath);
      if (!exists) {
        this.logger.warn(`Directory ${directoryPath} does not exist`);
        return [];
      }

      const entries = await this.vscodeFileSystem.readDirectory(directoryPath);
      const providers: ProviderMetadata[] = [];
      let manifestCount = 0;
      let successCount = 0;

      this.logger.debug(`Found ${entries.length} entries in directory ${directoryPath}`);

      for (const [name, fileType] of entries) {
        const isDirectory = (fileType & FileType.Directory) === FileType.Directory;
        if (isDirectory) {
          const providerPath = path.join(directoryPath, name);
          const manifestPath = path.join(providerPath, "manifest.json");

          const manifestExists = await this.vscodeFileSystem.fileExists(manifestPath);
          if (manifestExists) {
            manifestCount++;
            this.logger.debug(`Processing manifest ${manifestPath}`);

            try {
              const manifest =
                await this.providerFileSystemService.readProviderManifest(manifestPath);
              if (manifest) {
                providers.push(manifest);
                this.discoveredProviders.set(manifest.id, manifest);
                successCount++;
                this.logger.debug(
                  `Successfully loaded provider ${manifest.id} from ${manifestPath}`,
                );
              } else {
                this.logger.warn(`No valid manifest returned from ${manifestPath}`);
              }
            } catch (error) {
              this.logger.error(`Failed to load manifest from ${manifestPath}:`, error);
            }
          }
        }
      }

      const scanEndTime = Date.now();
      this.logger.debug(
        `Directory scan completed in ${scanEndTime - scanStartTime}ms - ${manifestCount} manifests found, ${successCount} providers loaded successfully`,
      );

      return providers;
    } catch (error) {
      const scanEndTime = Date.now();
      this.logger.error(
        `Directory scan failed for ${directoryPath} after ${scanEndTime - scanStartTime}ms:`,
        error,
      );
      throw error;
    }
  }

  async validateProviderManifest(manifest: Record<string, unknown>) {
    return this.manifestValidator.validateProviderManifest(manifest);
  }

  async loadProviderFromMetadata(metadata: ProviderMetadata): Promise<LLMProvider | null> {
    return this.providerLoader.loadProviderFromMetadata(metadata);
  }

  async startWatching(directories: string[]): Promise<void> {
    return this.directoryWatcher.startWatching(directories);
  }

  stopWatching(): void {
    this.directoryWatcher.stopWatching();
  }

  getDiscoveredProviders(): ProviderMetadata[] {
    return Array.from(this.discoveredProviders.values());
  }

  private async getProviderDirectories(): Promise<string[]> {
    const directories: string[] = [];

    const builtInProvidersPath = path.join(__dirname, "../../llm/providers");
    const exists = await this.vscodeFileSystem.fileExists(builtInProvidersPath);
    if (exists) {
      directories.push(builtInProvidersPath);
    }

    return directories;
  }
}
