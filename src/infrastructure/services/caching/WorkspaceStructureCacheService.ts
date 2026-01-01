import { ServiceLimits } from "@/constants";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "@/infrastructure/services/logging/LoggingService";
import { WorkspaceLevelCacheHandler } from "@/infrastructure/services/caching/workspace-cache/WorkspaceLevelCacheHandler";
import { FileLevelCacheHandler } from "@/infrastructure/services/caching/workspace-cache/FileLevelCacheHandler";
import type {
  ProjectTypeDetection,
  ProjectEssentialFile,
  FileRelevanceScore,
  DependencyMap,
} from "@/domain/entities/ContextIntelligence";
import type { ExtensionContextStorageService } from "@/infrastructure/services/storage/ExtensionContextStorageService";

export interface CachedWorkspaceStructure {
  rootName: string;
  overview: string;
  filesSample: string[];
  cachedAt: number;
  expiresAt: number;
}

export interface CachedProjectType {
  detection: ProjectTypeDetection;
  cachedAt: number;
  expiresAt: number;
  algorithmVersion?: number;
}

export interface CachedEssentialFiles {
  files: ProjectEssentialFile[];
  cachedAt: number;
  expiresAt: number;
}

export interface CachedFileRelevanceScores {
  scores: FileRelevanceScore[];
  cachedAt: number;
  expiresAt: number;
}

export interface CachedDependencyMap {
  dependencyMap: DependencyMap;
  cachedAt: number;
  expiresAt: number;
}

export class WorkspaceStructureCacheService {
  private logger: Logger;
  private workspaceCache: WorkspaceLevelCacheHandler;
  private fileCache: FileLevelCacheHandler;

  constructor(
    private extensionContextStorageService: ExtensionContextStorageService,
    private loggingService: LoggingService,
    useGlobalState: boolean = false,
  ) {
    this.logger = createLogger("WorkspaceStructureCacheService");
    const memento = useGlobalState
      ? extensionContextStorageService.globalState
      : extensionContextStorageService.workspaceState;
    this.workspaceCache = new WorkspaceLevelCacheHandler(memento, loggingService);
    this.fileCache = new FileLevelCacheHandler(memento, loggingService);
  }

  async getWorkspaceStructure(workspaceRoot: string): Promise<{
    rootName: string;
    overview: string;
    filesSample: string[];
  } | null> {
    return this.workspaceCache.getWorkspaceStructure(workspaceRoot);
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
    return this.workspaceCache.setWorkspaceStructure(workspaceRoot, structure, ttl);
  }

  async getProjectType(workspaceRoot: string): Promise<ProjectTypeDetection | null> {
    return this.workspaceCache.getProjectType(workspaceRoot);
  }

  async setProjectType(
    workspaceRoot: string,
    detection: ProjectTypeDetection,
    ttl: number = ServiceLimits.contextIntelligenceProjectTypeTTL,
  ): Promise<void> {
    return this.workspaceCache.setProjectType(workspaceRoot, detection, ttl);
  }

  async getEssentialFiles(workspaceRoot: string): Promise<ProjectEssentialFile[] | null> {
    return this.workspaceCache.getEssentialFiles(workspaceRoot);
  }

  async setEssentialFiles(
    workspaceRoot: string,
    files: ProjectEssentialFile[],
    ttl: number = ServiceLimits.contextIntelligenceProjectTypeTTL,
  ): Promise<void> {
    return this.workspaceCache.setEssentialFiles(workspaceRoot, files, ttl);
  }

  async deleteWorkspaceStructure(workspaceRoot: string): Promise<void> {
    return this.workspaceCache.deleteWorkspaceStructure(workspaceRoot);
  }

  async deleteProjectType(workspaceRoot: string): Promise<void> {
    return this.workspaceCache.deleteProjectType(workspaceRoot);
  }

  async deleteEssentialFiles(workspaceRoot: string): Promise<void> {
    return this.workspaceCache.deleteEssentialFiles(workspaceRoot);
  }

  async getFileRelevanceScores(targetFilePath: string): Promise<FileRelevanceScore[] | null> {
    return this.fileCache.getFileRelevanceScores(targetFilePath);
  }

  async setFileRelevanceScores(
    targetFilePath: string,
    scores: FileRelevanceScore[],
    ttl: number = ServiceLimits.contextIntelligenceFileRelevanceTTL,
  ): Promise<void> {
    return this.fileCache.setFileRelevanceScores(targetFilePath, scores, ttl);
  }

  async deleteFileRelevanceScores(targetFilePath: string): Promise<void> {
    return this.fileCache.deleteFileRelevanceScores(targetFilePath);
  }

  async getDependencyMap(filePath: string): Promise<DependencyMap | null> {
    return this.fileCache.getDependencyMap(filePath);
  }

  async setDependencyMap(
    filePath: string,
    dependencyMap: DependencyMap,
    ttl: number = ServiceLimits.contextIntelligenceFileRelevanceTTL,
  ): Promise<void> {
    return this.fileCache.setDependencyMap(filePath, dependencyMap, ttl);
  }

  async deleteDependencyMap(filePath: string): Promise<void> {
    return this.fileCache.deleteDependencyMap(filePath);
  }

  async clear(workspaceRoot: string): Promise<void> {
    return this.workspaceCache.clear(workspaceRoot);
  }
}
