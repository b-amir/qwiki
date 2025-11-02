import * as path from "path";
import * as crypto from "crypto";
import { FileType } from "vscode";
import { ProviderManifest } from "../../llm/types/ProviderMetadata";
import { ValidationResult } from "../../llm/types/ProviderCapabilities";
import { VSCodeFileSystemService } from "./VSCodeFileSystemService";
import { LoggingService, createLogger, type Logger } from "./LoggingService";

export class ProviderFileSystemService {
  private logger: Logger;

  constructor(
    private vscodeFileSystem: VSCodeFileSystemService,
    private loggingService: LoggingService = new LoggingService({
      enabled: false,
      level: "error",
      includeTimestamp: true,
      includeService: true,
    }),
  ) {
    this.logger = createLogger("ProviderFileSystemService", loggingService);
  }
  async readProviderManifest(manifestPath: string): Promise<ProviderManifest> {
    try {
      const exists = await this.vscodeFileSystem.fileExists(manifestPath);
      if (!exists) {
        throw new Error(`Manifest file not found: ${manifestPath}`);
      }

      const manifestContent = await this.vscodeFileSystem.readFile(manifestPath);
      const manifest = JSON.parse(manifestContent);

      if (!this.isValidManifest(manifest)) {
        throw new Error(`Invalid manifest format in ${manifestPath}`);
      }

      const calculatedChecksum = await this.calculateChecksum(manifestPath);
      if (manifest.checksum && manifest.checksum !== calculatedChecksum) {
        throw new Error(`Manifest checksum mismatch in ${manifestPath}`);
      }

      return manifest as ProviderManifest;
    } catch (error) {
      throw new Error(`Failed to read provider manifest from ${manifestPath}: ${error}`);
    }
  }

  async validateProviderFile(filePath: string): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const exists = await this.vscodeFileSystem.fileExists(filePath);
      if (!exists) {
        errors.push(`Provider file does not exist: ${filePath}`);
        return { isValid: false, errors, warnings };
      }

      const stats = await this.vscodeFileSystem.stat(filePath);
      if (!stats.isFile()) {
        errors.push(`Path is not a file: ${filePath}`);
        return { isValid: false, errors, warnings };
      }

      const fileContent = await this.vscodeFileSystem.readFile(filePath);

      if (filePath.endsWith(".js") || filePath.endsWith(".ts")) {
        if (fileContent.includes("eval(") || fileContent.includes("Function(")) {
          warnings.push("Provider code contains potentially unsafe eval or Function usage");
        }

        if (fileContent.includes("require(") && !fileContent.includes("require.main")) {
          warnings.push("Provider code uses require() which may cause security issues");
        }
      }

      const manifestPath = path.join(path.dirname(filePath), "manifest.json");
      const manifestExists = await this.vscodeFileSystem.fileExists(manifestPath);
      if (manifestExists) {
        const manifestValidation = await this.validateManifestFile(manifestPath);
        errors.push(...manifestValidation.errors);
        warnings.push(...manifestValidation.warnings);
      } else {
        warnings.push("No manifest.json found in provider directory");
      }
    } catch (error) {
      errors.push(`Failed to validate provider file: ${error}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  async getProviderFiles(directory: string): Promise<string[]> {
    const exists = await this.vscodeFileSystem.fileExists(directory);
    if (!exists) {
      return [];
    }

    const entries = await this.vscodeFileSystem.readDirectory(directory);
    const providerFiles: string[] = [];

    for (const [name, fileType] of entries) {
      const isFile = (fileType & FileType.File) === FileType.File;
      if (isFile) {
        const filePath = path.join(directory, name);
        const ext = path.extname(filePath).toLowerCase();

        if (ext === ".js" || ext === ".ts" || ext === ".json") {
          providerFiles.push(filePath);
        }
      }
    }

    return providerFiles;
  }

  async watchProviderDirectory(
    directory: string,
    callback: FileChangeCallback,
  ): Promise<{ close: () => void }> {
    return await this.vscodeFileSystem.watchDirectory(directory, (eventType, filename) => {
      if (filename) {
        const filePath = path.join(directory, filename);
        const ext = path.extname(filePath).toLowerCase();

        if ([".js", ".ts", ".json"].includes(ext)) {
          callback({
            eventType,
            filePath,
            filename,
            timestamp: new Date(),
          });
        }
      }
    });
  }

  async calculateChecksum(filePath: string): Promise<string> {
    try {
      const fileContent = await this.vscodeFileSystem.readFile(filePath);
      return crypto.createHash("sha256").update(fileContent).digest("hex");
    } catch (error) {
      throw new Error(`Failed to calculate checksum for ${filePath}: ${error}`);
    }
  }

  private async validateManifestFile(manifestPath: string): Promise<ValidationResult> {
    try {
      const manifestContent = await this.vscodeFileSystem.readFile(manifestPath);
      const manifest = JSON.parse(manifestContent);

      return this.validateManifestStructure(manifest);
    } catch (error) {
      return {
        isValid: false,
        errors: [`Invalid manifest JSON: ${error}`],
        warnings: [],
      };
    }
  }

  private validateManifestStructure(manifest: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!manifest.id || typeof manifest.id !== "string") {
      errors.push("Manifest must have a valid id string");
    }

    if (!manifest.name || typeof manifest.name !== "string") {
      errors.push("Manifest must have a valid name string");
    }

    if (!manifest.version || typeof manifest.version !== "string") {
      errors.push("Manifest must have a valid version string");
    }

    if (!manifest.entryPoint || typeof manifest.entryPoint !== "string") {
      errors.push("Manifest must have a valid entryPoint string");
    }

    if (!manifest.manifestVersion || typeof manifest.manifestVersion !== "string") {
      warnings.push("Manifest should specify manifestVersion");
    }

    if (!manifest.checksum) {
      warnings.push("Manifest should include checksum for integrity verification");
    }

    if (manifest.dependencies && !Array.isArray(manifest.dependencies)) {
      errors.push("Manifest dependencies must be an array");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private isValidManifest(manifest: any): boolean {
    return (
      manifest &&
      typeof manifest === "object" &&
      typeof manifest.id === "string" &&
      typeof manifest.name === "string" &&
      typeof manifest.version === "string" &&
      typeof manifest.entryPoint === "string"
    );
  }

  async createProviderDirectory(providerId: string, templatePath: string): Promise<string> {
    const providerDir = path.join(process.cwd(), "providers", providerId);

    const exists = await this.vscodeFileSystem.fileExists(providerDir);
    if (!exists) {
      await this.vscodeFileSystem.createDirectory(providerDir);
    }

    const manifestTemplate = {
      id: providerId,
      name: `${providerId} Provider`,
      version: "1.0.0",
      description: `Generated provider for ${providerId}`,
      author: "Qwiki",
      entryPoint: "./index.js",
      manifestVersion: "1.0.0",
      dependencies: [],
      minQwikiVersion: "1.0.0",
    };

    const manifestPath = path.join(providerDir, "manifest.json");
    await this.vscodeFileSystem.writeFile(manifestPath, JSON.stringify(manifestTemplate, null, 2));

    if (templatePath) {
      const templateExists = await this.vscodeFileSystem.fileExists(templatePath);
      if (templateExists) {
        const templateContent = await this.vscodeFileSystem.readFile(templatePath);
        const indexPath = path.join(providerDir, "index.js");
        await this.vscodeFileSystem.writeFile(indexPath, templateContent);
      }
    }

    return providerDir;
  }
}

export interface FileChangeCallback {
  (change: FileChangeEvent): void;
}

export interface FileChangeEvent {
  eventType: string;
  filePath: string;
  filename: string;
  timestamp: Date;
}
