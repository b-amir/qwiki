import * as fs from "fs";
import * as path from "path";
import { EventBus } from "../../events/EventBus";
import { ProviderMetadata, ProviderManifest } from "../../llm/types/ProviderMetadata";
import { LLMProvider } from "../../llm/types";
import { ValidationResult } from "../../llm/types/ProviderCapabilities";
import { ProviderFileSystemService } from "../../infrastructure/services/ProviderFileSystemService";

export class ProviderDiscoveryService {
  private discoveredProviders = new Map<string, ProviderMetadata>();
  private watchers: fs.FSWatcher[] = [];

  constructor(
    private eventBus: EventBus,
    private providerFileSystemService: ProviderFileSystemService,
  ) {}

  async discoverProviders(): Promise<ProviderMetadata[]> {
    const discoverStartTime = Date.now();
    console.log("[QWIKI] ProviderDiscoveryService: Starting provider discovery");

    try {
      const providerDirs = await this.getProviderDirectories();
      console.log(
        `[QWIKI] ProviderDiscoveryService: Found ${providerDirs.length} provider directories to scan`,
      );

      const allProviders: ProviderMetadata[] = [];

      for (const dir of providerDirs) {
        const scanStartTime = Date.now();
        console.log(`[QWIKI] ProviderDiscoveryService: Scanning directory ${dir}`);

        try {
          const providers = await this.scanDirectory(dir);
          allProviders.push(...providers);

          const scanEndTime = Date.now();
          console.log(
            `[QWIKI] ProviderDiscoveryService: Directory ${dir} scanned in ${scanEndTime - scanStartTime}ms, found ${providers.length} providers`,
          );
        } catch (error) {
          const scanEndTime = Date.now();
          console.error(
            `[QWIKI] ProviderDiscoveryService: Failed to scan directory ${dir} after ${scanEndTime - scanStartTime}ms:`,
            error,
          );
        }
      }

      const discoverEndTime = Date.now();
      console.log(
        `[QWIKI] ProviderDiscoveryService: Provider discovery completed in ${discoverEndTime - discoverStartTime}ms, found ${allProviders.length} total providers`,
      );

      return allProviders;
    } catch (error) {
      const discoverEndTime = Date.now();
      console.error(
        `[QWIKI] ProviderDiscoveryService: Provider discovery failed after ${discoverEndTime - discoverStartTime}ms:`,
        error,
      );
      throw error;
    }
  }

  async scanDirectory(directoryPath: string): Promise<ProviderMetadata[]> {
    const scanStartTime = Date.now();
    console.log(`[QWIKI] ProviderDiscoveryService: Scanning directory ${directoryPath}`);

    try {
      if (!fs.existsSync(directoryPath)) {
        console.warn(`[QWIKI] ProviderDiscoveryService: Directory ${directoryPath} does not exist`);
        return [];
      }

      const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
      const providers: ProviderMetadata[] = [];
      let manifestCount = 0;
      let successCount = 0;

      console.log(
        `[QWIKI] ProviderDiscoveryService: Found ${entries.length} entries in directory ${directoryPath}`,
      );

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const providerPath = path.join(directoryPath, entry.name);
          const manifestPath = path.join(providerPath, "manifest.json");

          if (fs.existsSync(manifestPath)) {
            manifestCount++;
            console.log(`[QWIKI] ProviderDiscoveryService: Processing manifest ${manifestPath}`);

            try {
              const manifest =
                await this.providerFileSystemService.readProviderManifest(manifestPath);
              if (manifest) {
                providers.push(manifest);
                this.discoveredProviders.set(manifest.id, manifest);
                successCount++;
                console.log(
                  `[QWIKI] ProviderDiscoveryService: Successfully loaded provider ${manifest.id} from ${manifestPath}`,
                );
              } else {
                console.warn(
                  `[QWIKI] ProviderDiscoveryService: No valid manifest returned from ${manifestPath}`,
                );
              }
            } catch (error) {
              console.error(
                `[QWIKI] ProviderDiscoveryService: Failed to load manifest from ${manifestPath}:`,
                error,
              );
            }
          }
        }
      }

      const scanEndTime = Date.now();
      console.log(
        `[QWIKI] ProviderDiscoveryService: Directory scan completed in ${scanEndTime - scanStartTime}ms - ${manifestCount} manifests found, ${successCount} providers loaded successfully`,
      );

      return providers;
    } catch (error) {
      const scanEndTime = Date.now();
      console.error(
        `[QWIKI] ProviderDiscoveryService: Directory scan failed for ${directoryPath} after ${scanEndTime - scanStartTime}ms:`,
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
    console.log(
      `[QWIKI] ProviderDiscoveryService: Loading provider ${metadata.id} from ${metadata.entryPoint}`,
    );

    try {
      const importStartTime = Date.now();
      const providerModule = await import(metadata.entryPoint);
      const importEndTime = Date.now();
      console.log(
        `[QWIKI] ProviderDiscoveryService: Module import completed in ${importEndTime - importStartTime}ms`,
      );

      const ProviderClass = providerModule.default || providerModule[metadata.id];

      if (!ProviderClass) {
        const error = new Error(`Provider class not found in ${metadata.entryPoint}`);
        console.error(`[QWIKI] ProviderDiscoveryService: ${error.message}`);
        throw error;
      }

      const instantiateStartTime = Date.now();
      const provider = new ProviderClass() as LLMProvider;
      const instantiateEndTime = Date.now();

      const loadEndTime = Date.now();
      console.log(
        `[QWIKI] ProviderDiscoveryService: Provider ${metadata.id} loaded successfully in ${loadEndTime - loadStartTime}ms (instantiate: ${instantiateEndTime - instantiateStartTime}ms)`,
      );

      return provider;
    } catch (error) {
      const loadEndTime = Date.now();
      console.error(
        `[QWIKI] ProviderDiscoveryService: Failed to load provider ${metadata.id} after ${loadEndTime - loadStartTime}ms:`,
        error,
      );
      return null;
    }
  }

  startWatching(directories: string[]): void {
    console.log(
      `[QWIKI] ProviderDiscoveryService: Starting to watch ${directories.length} directories for changes`,
    );
    this.stopWatching();

    for (const directory of directories) {
      if (fs.existsSync(directory)) {
        console.log(
          `[QWIKI] ProviderDiscoveryService: Setting up watcher for directory ${directory}`,
        );

        try {
          const watcher = this.providerFileSystemService.watchProviderDirectory(
            directory,
            (change) => {
              if (change.filename.endsWith("manifest.json")) {
                console.log(
                  `[QWIKI] ProviderDiscoveryService: Manifest file ${change.filename} changed in ${directory} (${change.eventType})`,
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
          console.log(
            `[QWIKI] ProviderDiscoveryService: Watcher established for directory ${directory}`,
          );
        } catch (error) {
          console.error(
            `[QWIKI] ProviderDiscoveryService: Failed to set up watcher for directory ${directory}:`,
            error,
          );
        }
      } else {
        console.warn(
          `[QWIKI] ProviderDiscoveryService: Directory ${directory} does not exist, cannot set up watcher`,
        );
      }
    }

    console.log(
      `[QWIKI] ProviderDiscoveryService: Watching set up with ${this.watchers.length} active watchers`,
    );
  }

  stopWatching(): void {
    console.log(
      `[QWIKI] ProviderDiscoveryService: Stopping ${this.watchers.length} directory watchers`,
    );

    try {
      for (const watcher of this.watchers) {
        watcher.close();
      }
      this.watchers = [];
      console.log(`[QWIKI] ProviderDiscoveryService: All directory watchers stopped`);
    } catch (error) {
      console.error(`[QWIKI] ProviderDiscoveryService: Error stopping directory watchers:`, error);
    }
  }

  getDiscoveredProviders(): ProviderMetadata[] {
    return Array.from(this.discoveredProviders.values());
  }

  private async getProviderDirectories(): Promise<string[]> {
    const directories: string[] = [];

    const builtInProvidersPath = path.join(__dirname, "../../llm/providers");
    if (fs.existsSync(builtInProvidersPath)) {
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
