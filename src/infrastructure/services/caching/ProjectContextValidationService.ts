import { workspace, Uri } from "vscode";
import type { ProjectContextCacheMetadata } from "@/infrastructure/services/caching/ProjectContextCacheService";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "@/infrastructure/services/logging/LoggingService";

export interface ProjectContextValidationResult {
  isValid: boolean;
  reason?: string;
}

export class ProjectContextValidationService {
  private logger: Logger;

  constructor(private loggingService: LoggingService) {
    this.logger = createLogger("ProjectContextValidationService");
  }

  async validateMetadata(
    metadata: ProjectContextCacheMetadata,
  ): Promise<ProjectContextValidationResult> {
    try {
      const workspaceFolders = workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        return { isValid: false, reason: "No workspace folders" };
      }

      const currentRoot = workspaceFolders[0].uri.fsPath;
      if (metadata.workspaceRoot !== currentRoot) {
        this.logger.debug("Workspace root changed", {
          cached: metadata.workspaceRoot,
          current: currentRoot,
        });
        return {
          isValid: false,
          reason: "Workspace root changed",
        };
      }

      if (metadata.packageJsonPath && metadata.packageJsonModified) {
        const packageJsonValidation = await this.validatePackageJson(
          metadata.packageJsonPath,
          metadata.packageJsonModified,
        );
        if (!packageJsonValidation.isValid) {
          return packageJsonValidation;
        }
      }

      return { isValid: true };
    } catch (error) {
      this.logger.error("Error validating cache metadata", { error });
      return { isValid: false, reason: "Validation error" };
    }
  }

  private async validatePackageJson(
    packageJsonPath: string,
    cachedModifiedTime: number,
  ): Promise<ProjectContextValidationResult> {
    try {
      const uri = Uri.file(packageJsonPath);
      const stat = await workspace.fs.stat(uri);
      const currentModifiedTime = stat.mtime;

      if (currentModifiedTime !== cachedModifiedTime) {
        this.logger.debug("package.json modified", {
          path: packageJsonPath,
          cached: new Date(cachedModifiedTime),
          current: new Date(currentModifiedTime),
        });
        return {
          isValid: false,
          reason: "package.json was modified",
        };
      }

      return { isValid: true };
    } catch (error: unknown) {
      const errObj = error as Record<string, unknown> | null;
      if (errObj?.code === "FileNotFound") {
        this.logger.debug("package.json not found", { path: packageJsonPath });
        return {
          isValid: false,
          reason: "package.json not found",
        };
      }
      this.logger.error("Error validating package.json", {
        path: packageJsonPath,
        error,
      });
      return { isValid: false, reason: "Validation error" };
    }
  }

  async buildMetadata(
    workspaceRoot: string,
    snippetHash: string,
    filePath?: string,
    languageId?: string,
  ): Promise<ProjectContextCacheMetadata> {
    const metadata: ProjectContextCacheMetadata = {
      workspaceRoot,
      snippetHash,
      filePath,
      languageId,
      fileCount: 0,
    };

    try {
      const packageJsonUris = await workspace.findFiles("**/package.json", "**/node_modules/**", 1);

      if (packageJsonUris.length > 0) {
        const packageJsonUri = packageJsonUris[0];
        metadata.packageJsonPath = packageJsonUri.fsPath;
        const stat = await workspace.fs.stat(packageJsonUri);
        metadata.packageJsonModified = stat.mtime;
      }
    } catch (error) {
      this.logger.debug("Error building metadata for package.json", { error });
    }

    return metadata;
  }
}
