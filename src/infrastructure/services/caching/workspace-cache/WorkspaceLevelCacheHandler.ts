import type { Memento } from "vscode";
import { ServiceLimits } from "@/constants";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "@/infrastructure/services/logging/LoggingService";
import type {
  ProjectTypeDetection,
  ProjectEssentialFile,
} from "@/domain/entities/ContextIntelligence";
import type {
  CachedWorkspaceStructure,
  CachedProjectType,
  CachedEssentialFiles,
} from "../WorkspaceStructureCacheService";

// Increment this when the project type detection algorithm changes
const PROJECT_TYPE_ALGORITHM_VERSION = 2; // v2 = weighted scoring

export class WorkspaceLevelCacheHandler {
  private logger: Logger;
  private readonly WORKSPACE_STRUCTURE_KEY = "qwiki:workspaceStructure:";
  private readonly PROJECT_TYPE_KEY = "qwiki:projectType:";
  private readonly ESSENTIAL_FILES_KEY = "qwiki:essentialFiles:";

  constructor(
    private memento: Memento,
    private loggingService: LoggingService,
  ) {
    this.logger = createLogger("WorkspaceLevelCacheHandler");
  }

  async getWorkspaceStructure(workspaceRoot: string): Promise<{
    rootName: string;
    overview: string;
    filesSample: string[];
  } | null> {
    try {
      const key = `${this.WORKSPACE_STRUCTURE_KEY}${workspaceRoot}`;
      const cached = this.memento.get<CachedWorkspaceStructure>(key);

      if (!cached) {
        return null;
      }

      const now = Date.now();
      if (now > cached.expiresAt) {
        this.logger.debug("Workspace structure cache expired", {
          age: now - cached.cachedAt,
        });
        await this.deleteWorkspaceStructure(workspaceRoot);
        return null;
      }

      this.logger.debug("Workspace structure cache hit", {
        rootName: cached.rootName,
        fileCount: cached.filesSample.length,
      });

      return {
        rootName: cached.rootName,
        overview: cached.overview,
        filesSample: cached.filesSample,
      };
    } catch (error) {
      this.logger.error("Error reading workspace structure cache", { error });
      return null;
    }
  }

  async setWorkspaceStructure(
    workspaceRoot: string,
    structure: {
      rootName: string;
      overview: string;
      filesSample: string[];
    },
    ttl: number = ServiceLimits.projectContextCacheTTL,
  ): Promise<void> {
    try {
      const now = Date.now();
      const cached: CachedWorkspaceStructure = {
        ...structure,
        cachedAt: now,
        expiresAt: now + ttl,
      };

      const key = `${this.WORKSPACE_STRUCTURE_KEY}${workspaceRoot}`;
      await this.memento.update(key, cached);

      this.logger.debug("Workspace structure cached", {
        rootName: structure.rootName,
        fileCount: structure.filesSample.length,
      });
    } catch (error) {
      this.logger.error("Error caching workspace structure", { error });
    }
  }

  async getProjectType(workspaceRoot: string): Promise<ProjectTypeDetection | null> {
    try {
      const key = `${this.PROJECT_TYPE_KEY}${workspaceRoot}`;
      const cached = this.memento.get<CachedProjectType>(key);

      if (!cached) {
        return null;
      }

      const now = Date.now();
      if (now > cached.expiresAt) {
        await this.deleteProjectType(workspaceRoot);
        return null;
      }

      // Invalidate cache if algorithm version changed
      if (cached.algorithmVersion !== PROJECT_TYPE_ALGORITHM_VERSION) {
        this.logger.debug("Project type cache invalidated due to algorithm version change", {
          cachedVersion: cached.algorithmVersion,
          currentVersion: PROJECT_TYPE_ALGORITHM_VERSION,
        });
        await this.deleteProjectType(workspaceRoot);
        return null;
      }

      this.logger.debug("Project type cache hit", {
        language: cached.detection.primaryLanguage,
        confidence: cached.detection.confidence,
      });

      return cached.detection;
    } catch (error) {
      this.logger.error("Error reading project type cache", { error });
      return null;
    }
  }

  async setProjectType(
    workspaceRoot: string,
    detection: ProjectTypeDetection,
    ttl: number = ServiceLimits.contextIntelligenceProjectTypeTTL,
  ): Promise<void> {
    try {
      const now = Date.now();
      const cached: CachedProjectType = {
        detection,
        cachedAt: now,
        expiresAt: now + ttl,
        algorithmVersion: PROJECT_TYPE_ALGORITHM_VERSION,
      };

      const key = `${this.PROJECT_TYPE_KEY}${workspaceRoot}`;
      await this.memento.update(key, cached);

      this.logger.debug("Project type cached", {
        language: detection.primaryLanguage,
        confidence: detection.confidence,
      });
    } catch (error) {
      this.logger.error("Error caching project type", { error });
    }
  }

  async getEssentialFiles(workspaceRoot: string): Promise<ProjectEssentialFile[] | null> {
    try {
      const key = `${this.ESSENTIAL_FILES_KEY}${workspaceRoot}`;
      const cached = this.memento.get<CachedEssentialFiles>(key);

      if (!cached) {
        return null;
      }

      const now = Date.now();
      if (now > cached.expiresAt) {
        await this.deleteEssentialFiles(workspaceRoot);
        return null;
      }

      this.logger.debug("Essential files cache hit", {
        fileCount: cached.files.length,
      });

      return cached.files;
    } catch (error) {
      this.logger.error("Error reading essential files cache", { error });
      return null;
    }
  }

  async setEssentialFiles(
    workspaceRoot: string,
    files: ProjectEssentialFile[],
    ttl: number = ServiceLimits.contextIntelligenceProjectTypeTTL,
  ): Promise<void> {
    try {
      const now = Date.now();
      const cached: CachedEssentialFiles = {
        files,
        cachedAt: now,
        expiresAt: now + ttl,
      };

      const key = `${this.ESSENTIAL_FILES_KEY}${workspaceRoot}`;
      await this.memento.update(key, cached);

      this.logger.debug("Essential files cached", { fileCount: files.length });
    } catch (error) {
      this.logger.error("Error caching essential files", { error });
    }
  }

  async deleteWorkspaceStructure(workspaceRoot: string): Promise<void> {
    const key = `${this.WORKSPACE_STRUCTURE_KEY}${workspaceRoot}`;
    await this.memento.update(key, undefined);
  }

  async deleteProjectType(workspaceRoot: string): Promise<void> {
    const key = `${this.PROJECT_TYPE_KEY}${workspaceRoot}`;
    await this.memento.update(key, undefined);
  }

  async deleteEssentialFiles(workspaceRoot: string): Promise<void> {
    const key = `${this.ESSENTIAL_FILES_KEY}${workspaceRoot}`;
    await this.memento.update(key, undefined);
  }

  async clear(workspaceRoot: string): Promise<void> {
    await Promise.all([
      this.deleteWorkspaceStructure(workspaceRoot),
      this.deleteProjectType(workspaceRoot),
      this.deleteEssentialFiles(workspaceRoot),
    ]);
  }
}
