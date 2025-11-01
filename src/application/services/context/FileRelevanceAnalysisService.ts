import { workspace, Uri } from "vscode";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "../../../infrastructure/services/LoggingService";
import { CachingService } from "../../../infrastructure/services/CachingService";
import { ServiceLimits } from "../../../constants";
import type {
  FileRelevanceScore,
  FileRelevanceMetadata,
  ProjectTypeDetection,
} from "../../../domain/entities/ContextIntelligence";

export class FileRelevanceAnalysisService {
  private logger: Logger;
  private readonly FILE_RELEVANCE_PREFIX = "context-intelligence:file-relevance:";

  constructor(
    private cachingService: CachingService,
    private loggingService: LoggingService,
  ) {
    this.logger = createLogger("FileRelevanceAnalysisService", loggingService);
  }

  private logDebug(message: string, data?: unknown): void {
    this.logger.debug(message, data);
  }

  async analyzeFileRelevance(
    targetPath: string,
    candidatePath: string,
    projectType: ProjectTypeDetection,
  ): Promise<FileRelevanceScore> {
    const cacheKey = `${this.FILE_RELEVANCE_PREFIX}${targetPath}:${candidatePath}`;
    const cached = await this.cachingService.get<FileRelevanceScore>(cacheKey);
    if (cached) {
      return cached;
    }

    const workspaceFolders = workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      throw new Error("No workspace folder found");
    }

    let fileContent = "";
    try {
      const fileUri = Uri.file(candidatePath);
      const content = await workspace.fs.readFile(fileUri);
      fileContent = Buffer.from(content).toString("utf8");
    } catch (error) {
      this.logDebug(`Failed to read file ${candidatePath}`, error);
    }

    const tokenCost = this.estimateTokenCount(fileContent);
    const pathSimilarity = this.calculatePathSimilarity(targetPath, candidatePath);
    const semanticScore = pathSimilarity * 30;
    const isDependency = await this.isDependencyFile(candidatePath);
    const dependencyScore = isDependency ? 40 : 0;
    const isImportedBy = await this.findImportRelationships(candidatePath, targetPath);
    const importScore = isImportedBy ? 30 : 0;
    const totalScore = Math.min(100, semanticScore + dependencyScore + importScore);

    const metadata: FileRelevanceMetadata = {
      isDependency,
      isImportedBy: isImportedBy ? [targetPath] : [],
      importsFrom: [],
      semanticSimilarity: pathSimilarity,
      lastModified: new Date(),
      complexity: 0,
      fileCategory: this.detectFileCategory(candidatePath),
    };

    const score: FileRelevanceScore = {
      filePath: candidatePath,
      score: totalScore,
      relevanceType: isDependency ? "dependency" : pathSimilarity > 0.5 ? "semantic" : "structural",
      tokenCost,
      compressionRatio: 0.3,
      metadata,
    };

    await this.cachingService.set(cacheKey, score, {
      ttl: ServiceLimits.contextIntelligenceFileRelevanceTTL,
    });

    return score;
  }

  private estimateTokenCount(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private calculatePathSimilarity(path1: string, path2: string): number {
    const parts1 = path1.split(/[/\\]/);
    const parts2 = path2.split(/[/\\]/);
    const minLength = Math.min(parts1.length, parts2.length);
    let matchingParts = 0;

    for (let i = 0; i < minLength; i++) {
      if (parts1[i] === parts2[i]) {
        matchingParts++;
      } else {
        break;
      }
    }

    return minLength > 0 ? matchingParts / Math.max(parts1.length, parts2.length) : 0;
  }

  private async isDependencyFile(filePath: string): Promise<boolean> {
    const dependencyPatterns = [
      /package\.json$/,
      /requirements\.txt$/,
      /pyproject\.toml$/,
      /pom\.xml$/,
      /build\.gradle$/,
      /Cargo\.toml$/,
      /go\.mod$/,
      /composer\.json$/,
      /\.csproj$/,
    ];

    return dependencyPatterns.some((pattern) => pattern.test(filePath));
  }

  private async findImportRelationships(
    candidatePath: string,
    targetPath: string,
  ): Promise<boolean> {
    try {
      const candidateUri = Uri.file(candidatePath);
      const content = await workspace.fs.readFile(candidateUri);
      const contentStr = Buffer.from(content).toString("utf8");

      const targetFileName = targetPath
        .split(/[/\\]/)
        .pop()
        ?.replace(/\.[^.]+$/, "");
      if (!targetFileName) {
        return false;
      }

      const importPatterns = [
        new RegExp(`import.*from\\s+['"].*${targetFileName}['"]`, "i"),
        new RegExp(`require\\(['"].*${targetFileName}['"]\\)`, "i"),
        new RegExp(`from\\s+['"].*${targetFileName}['"]`, "i"),
      ];

      return importPatterns.some((pattern) => pattern.test(contentStr));
    } catch {
      return false;
    }
  }

  private detectFileCategory(filePath: string): "config" | "source" | "test" | "docs" {
    if (/\.config\.|config\/|\.json$|\.toml$|\.yaml$|\.yml$/.test(filePath)) {
      return "config";
    }
    if (/test|spec|__tests__|\.test\.|\.spec\./.test(filePath)) {
      return "test";
    }
    if (/\.md$|docs?\/|readme/i.test(filePath)) {
      return "docs";
    }
    return "source";
  }
}
