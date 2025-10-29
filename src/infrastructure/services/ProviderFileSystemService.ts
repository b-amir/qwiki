import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { ProviderManifest } from "../../llm/types/ProviderMetadata";
import { ValidationResult } from "../../llm/types/ProviderCapabilities";

export class ProviderFileSystemService {
  async readProviderManifest(manifestPath: string): Promise<ProviderManifest> {
    try {
      if (!fs.existsSync(manifestPath)) {
        throw new Error(`Manifest file not found: ${manifestPath}`);
      }

      const manifestContent = fs.readFileSync(manifestPath, "utf-8");
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
      if (!fs.existsSync(filePath)) {
        errors.push(`Provider file does not exist: ${filePath}`);
        return { isValid: false, errors, warnings };
      }

      const stats = fs.statSync(filePath);
      if (!stats.isFile()) {
        errors.push(`Path is not a file: ${filePath}`);
        return { isValid: false, errors, warnings };
      }

      const fileContent = fs.readFileSync(filePath, "utf-8");

      if (filePath.endsWith(".js") || filePath.endsWith(".ts")) {
        if (fileContent.includes("eval(") || fileContent.includes("Function(")) {
          warnings.push("Provider code contains potentially unsafe eval or Function usage");
        }

        if (fileContent.includes("require(") && !fileContent.includes("require.main")) {
          warnings.push("Provider code uses require() which may cause security issues");
        }
      }

      const manifestPath = path.join(path.dirname(filePath), "manifest.json");
      if (fs.existsSync(manifestPath)) {
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
    if (!fs.existsSync(directory)) {
      return [];
    }

    const entries = fs.readdirSync(directory, { withFileTypes: true });
    const providerFiles: string[] = [];

    for (const entry of entries) {
      if (entry.isFile()) {
        const filePath = path.join(directory, entry.name);
        const ext = path.extname(filePath).toLowerCase();

        if (ext === ".js" || ext === ".ts" || ext === ".json") {
          providerFiles.push(filePath);
        }
      }
    }

    return providerFiles;
  }

  watchProviderDirectory(directory: string, callback: FileChangeCallback): fs.FSWatcher {
    if (!fs.existsSync(directory)) {
      throw new Error(`Directory does not exist: ${directory}`);
    }

    const watcher = fs.watch(directory, { recursive: true }, (eventType, filename) => {
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

    return watcher;
  }

  async calculateChecksum(filePath: string): Promise<string> {
    try {
      const fileContent = fs.readFileSync(filePath, "utf-8");
      return crypto.createHash("sha256").update(fileContent).digest("hex");
    } catch (error) {
      throw new Error(`Failed to calculate checksum for ${filePath}: ${error}`);
    }
  }

  private async validateManifestFile(manifestPath: string): Promise<ValidationResult> {
    try {
      const manifestContent = fs.readFileSync(manifestPath, "utf-8");
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

    if (!fs.existsSync(providerDir)) {
      fs.mkdirSync(providerDir, { recursive: true });
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
    fs.writeFileSync(manifestPath, JSON.stringify(manifestTemplate, null, 2));

    if (templatePath && fs.existsSync(templatePath)) {
      const templateContent = fs.readFileSync(templatePath, "utf-8");
      const indexPath = path.join(providerDir, "index.js");
      fs.writeFileSync(indexPath, templateContent);
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
