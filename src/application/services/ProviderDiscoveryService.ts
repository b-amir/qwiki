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
    const providerDirs = await this.getProviderDirectories();
    const allProviders: ProviderMetadata[] = [];

    for (const dir of providerDirs) {
      try {
        const providers = await this.scanDirectory(dir);
        allProviders.push(...providers);
      } catch (error) {
        console.error(`Failed to scan directory ${dir}:`, error);
      }
    }

    return allProviders;
  }

  async scanDirectory(directoryPath: string): Promise<ProviderMetadata[]> {
    if (!fs.existsSync(directoryPath)) {
      return [];
    }

    const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
    const providers: ProviderMetadata[] = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const providerPath = path.join(directoryPath, entry.name);
        const manifestPath = path.join(providerPath, "manifest.json");

        if (fs.existsSync(manifestPath)) {
          try {
            const manifest =
              await this.providerFileSystemService.readProviderManifest(manifestPath);
            if (manifest) {
              providers.push(manifest);
              this.discoveredProviders.set(manifest.id, manifest);
            }
          } catch (error) {
            console.error(`Failed to load manifest from ${manifestPath}:`, error);
          }
        }
      }
    }

    return providers;
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
    try {
      const providerModule = await import(metadata.entryPoint);
      const ProviderClass = providerModule.default || providerModule[metadata.id];

      if (!ProviderClass) {
        throw new Error(`Provider class not found in ${metadata.entryPoint}`);
      }

      return new ProviderClass() as LLMProvider;
    } catch (error) {
      console.error(`Failed to load provider ${metadata.id}:`, error);
      return null;
    }
  }

  startWatching(directories: string[]): void {
    this.stopWatching();

    for (const directory of directories) {
      if (fs.existsSync(directory)) {
        const watcher = this.providerFileSystemService.watchProviderDirectory(
          directory,
          (change) => {
            if (change.filename.endsWith("manifest.json")) {
              this.eventBus.publish("provider-manifest-changed", {
                directory,
                filename: change.filename,
                eventType: change.eventType,
              });
            }
          },
        );

        this.watchers.push(watcher);
      }
    }
  }

  stopWatching(): void {
    for (const watcher of this.watchers) {
      watcher.close();
    }
    this.watchers = [];
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
