import * as path from "path";
import { FileType } from "vscode";
import { EventBus } from "../../events/EventBus";
import { ProviderMetadata, ProviderManifest } from "../../llm/types/ProviderMetadata";
import { LLMProvider } from "../../llm/types";
import { ValidationResult } from "../../llm/types/ProviderCapabilities";
import { ProviderFileSystemService } from "../../infrastructure/services/ProviderFileSystemService";
import { VSCodeFileSystemService } from "../../infrastructure/services/VSCodeFileSystemService";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "../../infrastructure/services/LoggingService";

export class ProviderDiscoveryService {
  private discoveredProviders = new Map<string, ProviderMetadata>();
  private watchers: { close: () => void }[] = [];
  private logger: Logger;

  constructor(
    private eventBus: EventBus,
    private providerFileSystemService: ProviderFileSystemService,
    private vscodeFileSystem: VSCodeFileSystemService,
    private loggingService: LoggingService = new LoggingService({
      mode: "none",
      includeTimestamp: true,
      includeService: true,
    }),
  ) {
    this.logger = createLogger("ProviderDiscoveryService");
  }

  private logDebug(message: string, data?: unknown): void {
    this.logger.debug(message, data);
  }

  private logInfo(message: string, data?: unknown): void {
    this.logger.info(message, data);
  }

  private logWarn(message: string, data?: unknown): void {
    this.logger.warn(message, data);
  }

  private logError(message: string, data?: unknown): void {
    this.logger.error(message, data);
  }

  async discoverProviders(): Promise<ProviderMetadata[]> {
    const discoverStartTime = Date.now();
    this.logDebug("Starting provider discovery");

    try {
      const providerDirs = await this.getProviderDirectories();
      this.logDebug(`Found ${providerDirs.length} provider directories to scan`);

      const allProviders: ProviderMetadata[] = [];

      for (const dir of providerDirs) {
        const scanStartTime = Date.now();
        this.logDebug(`Scanning directory ${dir}`);

        try {
          const providers = await this.scanDirectory(dir);
          allProviders.push(...providers);

          const scanEndTime = Date.now();
          this.logDebug(
            `Directory ${dir} scanned in ${scanEndTime - scanStartTime}ms, found ${providers.length} providers`,
          );
        } catch (error) {
          const scanEndTime = Date.now();
          this.logError(
            `Failed to scan directory ${dir} after ${scanEndTime - scanStartTime}ms:`,
            error,
          );
        }
      }

      const discoverEndTime = Date.now();
      this.logDebug(
        `Provider discovery completed in ${discoverEndTime - discoverStartTime}ms, found ${allProviders.length} total providers`,
      );

      return allProviders;
    } catch (error) {
      const discoverEndTime = Date.now();
      this.logError(
        `Provider discovery failed after ${discoverEndTime - discoverStartTime}ms:`,
        error,
      );
      throw error;
    }
  }

  async scanDirectory(directoryPath: string): Promise<ProviderMetadata[]> {
    const scanStartTime = Date.now();
    this.logDebug(`Scanning directory ${directoryPath}`);

    try {
      const exists = await this.vscodeFileSystem.fileExists(directoryPath);
      if (!exists) {
        this.logWarn(`Directory ${directoryPath} does not exist`);
        return [];
      }

      const entries = await this.vscodeFileSystem.readDirectory(directoryPath);
      const providers: ProviderMetadata[] = [];
      let manifestCount = 0;
      let successCount = 0;

      this.logDebug(`Found ${entries.length} entries in directory ${directoryPath}`);

      for (const [name, fileType] of entries) {
        const isDirectory = (fileType & FileType.Directory) === FileType.Directory;
        if (isDirectory) {
          const providerPath = path.join(directoryPath, name);
          const manifestPath = path.join(providerPath, "manifest.json");

          const manifestExists = await this.vscodeFileSystem.fileExists(manifestPath);
          if (manifestExists) {
            manifestCount++;
            this.logDebug(`Processing manifest ${manifestPath}`);

            try {
              const manifest =
                await this.providerFileSystemService.readProviderManifest(manifestPath);
              if (manifest) {
                providers.push(manifest);
                this.discoveredProviders.set(manifest.id, manifest);
                successCount++;
                this.logDebug(`Successfully loaded provider ${manifest.id} from ${manifestPath}`);
              } else {
                this.logWarn(`No valid manifest returned from ${manifestPath}`);
              }
            } catch (error) {
              this.logError(`Failed to load manifest from ${manifestPath}:`, error);
            }
          }
        }
      }

      const scanEndTime = Date.now();
      this.logDebug(
        `Directory scan completed in ${scanEndTime - scanStartTime}ms - ${manifestCount} manifests found, ${successCount} providers loaded successfully`,
      );

      return providers;
    } catch (error) {
      const scanEndTime = Date.now();
      this.logError(
        `Directory scan failed for ${directoryPath} after ${scanEndTime - scanStartTime}ms:`,
        error,
      );
      throw error;
    }
  }

  async validateProviderManifest(manifest: any): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!manifest.id || typeof manifest.id !== "string") {
      errors.push("Provider ID is required and must be a string");
    }

    if (!manifest.name || typeof manifest.name !== "string") {
      errors.push("Provider name is required and must be a string");
    }

    if (!manifest.version || typeof manifest.version !== "string") {
      errors.push("Provider version is required and must be a string");
    }

    if (!manifest.entryPoint || typeof manifest.entryPoint !== "string") {
      errors.push("Provider entry point is required and must be a string");
    }

    if (!manifest.capabilities || typeof manifest.capabilities !== "object") {
      errors.push("Provider capabilities are required and must be an object");
    }

    if (!Array.isArray(manifest.dependencies)) {
      warnings.push("Dependencies should be an array, even if empty");
    }

    if (!manifest.minQwikiVersion || typeof manifest.minQwikiVersion !== "string") {
      warnings.push("Minimum Qwiki version should be specified");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  async loadProviderFromMetadata(metadata: ProviderMetadata): Promise<LLMProvider | null> {
    const loadStartTime = Date.now();
    this.logDebug(`Loading provider ${metadata.id} from ${metadata.entryPoint}`);

    try {
      const importStartTime = Date.now();
      const providerModule = await import(metadata.entryPoint);
      const importEndTime = Date.now();
      this.logDebug(`Module import completed in ${importEndTime - importStartTime}ms`);

      const ProviderClass = providerModule.default || providerModule[metadata.id];

      if (!ProviderClass) {
        const error = new Error(`Provider class not found in ${metadata.entryPoint}`);
        this.logError(`${error.message}`);
        throw error;
      }

      const instantiateStartTime = Date.now();
      const provider = new ProviderClass() as LLMProvider;
      const instantiateEndTime = Date.now();

      const loadEndTime = Date.now();
      this.logDebug(
        `Provider ${metadata.id} loaded successfully in ${loadEndTime - loadStartTime}ms (instantiate: ${instantiateEndTime - instantiateStartTime}ms)`,
      );

      return provider;
    } catch (error) {
      const loadEndTime = Date.now();
      this.logError(
        `Failed to load provider ${metadata.id} after ${loadEndTime - loadStartTime}ms:`,
        error,
      );
      return null;
    }
  }

  async startWatching(directories: string[]): Promise<void> {
    this.logDebug(`Starting to watch ${directories.length} directories for changes`);
    this.stopWatching();

    for (const directory of directories) {
      const exists = await this.vscodeFileSystem.fileExists(directory);
      if (exists) {
        this.logDebug(`Setting up watcher for directory ${directory}`);

        try {
          const watcher = await this.providerFileSystemService.watchProviderDirectory(
            directory,
            (change) => {
              if (change.filename.endsWith("manifest.json")) {
                this.logDebug(
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
          this.logDebug(`Watcher established for directory ${directory}`);
        } catch (error) {
          this.logError(`Failed to set up watcher for directory ${directory}:`, error);
        }
      } else {
        this.logWarn(`Directory ${directory} does not exist, cannot set up watcher`);
      }
    }

    this.logDebug(`Watching set up with ${this.watchers.length} active watchers`);
  }

  stopWatching(): void {
    this.logDebug(`Stopping ${this.watchers.length} directory watchers`);

    try {
      for (const watcher of this.watchers) {
        watcher.close();
      }
      this.watchers = [];
      this.logDebug(`All directory watchers stopped`);
    } catch (error) {
      this.logError(`Error stopping directory watchers:`, error);
    }
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

  private async readProviderManifest(manifestPath: string): Promise<ProviderManifest | null> {
    try {
      const manifest = await this.providerFileSystemService.readProviderManifest(manifestPath);

      const validation = await this.validateProviderManifest(manifest);
      if (!validation.isValid) {
        throw new Error(`Invalid manifest: ${validation.errors.join(", ")}`);
      }

      return manifest;
    } catch (error) {
      return null;
    }
  }
}
