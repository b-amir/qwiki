import { workspace } from "vscode";
import { LoggingService, createLogger, type Logger } from "@/infrastructure/services";
import { CachingService } from "@/infrastructure/services";
import { WorkspaceStructureCacheService } from "@/infrastructure/services/caching/WorkspaceStructureCacheService";
import { DependencyAnalysisService } from "@/application/services/context/project/DependencyAnalysisService";
import { VSCodeFileSystemService } from "@/infrastructure/services/filesystem/VSCodeFileSystemService";
import { ServiceLimits, FilePatterns } from "@/constants";
import type {
  FileRelevanceScore,
  FileRelevanceMetadata,
  ProjectTypeDetection,
} from "@/domain/entities/ContextIntelligence";

export class FileRelevanceAnalysisService {
  private logger: Logger;
  private readonly FILE_RELEVANCE_PREFIX = "context-intelligence:file-relevance:";
  private readonly KEY_FILES_KEY = "context-intelligence:key-files";

  constructor(
    private vscodeFileSystem: VSCodeFileSystemService,
    private cachingService: CachingService,
    private workspaceStructureCache: WorkspaceStructureCacheService,
    private dependencyAnalysisService: DependencyAnalysisService,
    private loggingService: LoggingService,
  ) {
    this.logger = createLogger("FileRelevanceAnalysisService");
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

    if (this.shouldSkipFile(candidatePath)) {
      const skipScore: FileRelevanceScore = {
        filePath: candidatePath,
        score: 0,
        relevanceType: "structural",
        tokenCost: 0,
        compressionRatio: 0.3,
        metadata: {
          isDependency: false,
          isImportedBy: [],
          importsFrom: [],
          semanticSimilarity: 0,
          lastModified: new Date(),
          complexity: 0,
          fileCategory: "source",
        },
      };
      await this.cachingService.set(cacheKey, skipScore, {
        ttl: ServiceLimits.contextIntelligenceFileRelevanceTTL,
      });
      return skipScore;
    }

    let fileContent = "";
    let lastModified = new Date();
    try {
      fileContent = await this.vscodeFileSystem.readFile(candidatePath, true);
      const stat = await this.vscodeFileSystem.stat(candidatePath);
      lastModified = stat.mtime ? new Date(stat.mtime) : new Date();
    } catch (error) {
      this.logDebug(`Failed to read file ${candidatePath}`, error);
    }

    const tokenCost = this.estimateTokenCount(fileContent);
    const pathSimilarity = this.calculatePathSimilarity(targetPath, candidatePath);

    let targetFileContent = "";
    try {
      targetFileContent = await this.vscodeFileSystem.readFile(targetPath, true);
    } catch {
      targetFileContent = "";
    }
    const semanticSimilarity = await this.calculateSemanticSimilarity(
      targetFileContent,
      fileContent,
    );
    const isDependency = await this.isDependencyFile(candidatePath);
    const imports = this.extractImportsOnly(fileContent);
    const isImportedBy = await this.dependencyAnalysisService.isFileDependentOn(
      candidatePath,
      targetPath,
    );
    const recencyScore = this.calculateRecencyScore(lastModified);
    const fileSizeScore = this.calculateFileSizeScore(fileContent.length);

    const semanticScore = semanticSimilarity * 25;
    const pathScore = pathSimilarity * 15;
    const dependencyScore = isDependency ? 30 : 0;
    const importScore = isImportedBy ? 20 : 0;
    const recencyFactor = recencyScore * 5;
    const sizeFactor = fileSizeScore * 5;

    const totalScore = Math.min(
      100,
      semanticScore + pathScore + dependencyScore + importScore + recencyFactor + sizeFactor,
    );

    const metadata: FileRelevanceMetadata = {
      isDependency,
      isImportedBy: isImportedBy ? [targetPath] : [],
      importsFrom: imports,
      semanticSimilarity: semanticSimilarity,
      lastModified,
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

  async calculateSemanticSimilarity(content1: string, content2: string): Promise<number> {
    if (!content1 || !content2) {
      return 0;
    }

    const patterns1 = this.analyzeNamingPatterns(content1);
    const patterns2 = this.analyzeNamingPatterns(content2);
    const patterns1Set = new Set(patterns1);
    const patterns2Set = new Set(patterns2);

    let matches = 0;
    for (const pattern of patterns1Set) {
      if (patterns2Set.has(pattern)) {
        matches++;
      }
    }

    const total = Math.max(patterns1Set.size, patterns2Set.size);
    return total > 0 ? matches / total : 0;
  }

  async identifyKeyProjectFiles(): Promise<string[]> {
    const cached = await this.cachingService.get<string[]>(this.KEY_FILES_KEY);
    if (cached) {
      return cached;
    }

    const workspaceFolders = workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return [];
    }

    const keyFiles: string[] = [];
    const keyPatterns = [
      "package.json",
      "tsconfig.json",
      "README.md",
      "index.ts",
      "index.js",
      "main.ts",
      "main.js",
      "app.ts",
      "app.js",
    ];

    for (const pattern of keyPatterns) {
      try {
        const files = await workspace.findFiles(
          `**/${pattern}`,
          FilePatterns.exclude,
          ServiceLimits.contextIntelligenceKeyFilesLimit,
        );
        for (const fileUri of files) {
          keyFiles.push(fileUri.fsPath);
        }
      } catch (error) {
        this.logDebug(`Failed to find key file ${pattern}`, error);
      }
    }

    await this.cachingService.set(this.KEY_FILES_KEY, keyFiles, {
      ttl: ServiceLimits.contextIntelligenceProjectTypeTTL,
    });

    return keyFiles;
  }

  private analyzeNamingPatterns(content: string): string[] {
    const patterns: string[] = [];
    const identifierPattern = /\b[a-z][a-zA-Z0-9]*\b/g;
    const matches = content.match(identifierPattern) || [];

    const wordFreq = new Map<string, number>();
    for (const word of matches) {
      if (word.length >= 3) {
        wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
      }
    }

    const sorted = Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);

    for (const [word] of sorted) {
      patterns.push(word);
    }

    return patterns;
  }

  private calculateRecencyScore(lastModified: Date): number {
    const now = Date.now();
    const modified = lastModified.getTime();
    const daysSinceModified = (now - modified) / (1000 * 60 * 60 * 24);

    if (daysSinceModified < 1) return 1.0;
    if (daysSinceModified < 7) return 0.8;
    if (daysSinceModified < 30) return 0.5;
    if (daysSinceModified < 90) return 0.3;
    return 0.1;
  }

  private calculateFileSizeScore(fileSize: number): number {
    if (fileSize < 100) return 0.2;
    if (fileSize < 1000) return 0.5;
    if (fileSize < 10000) return 1.0;
    if (fileSize < 50000) return 0.7;
    return 0.3;
  }

  private shouldSkipFile(filePath: string): boolean {
    const normalizedPath = filePath.replace(/\\/g, "/").toLowerCase();
    const skipPatterns = [
      "/dist/",
      "/node_modules/",
      "/.git/",
      "/.qwiki/",
      "/out/",
      "/build/",
      "/.vscode/",
      "/tmp/",
      "/temp/",
      "/_refs/",
      ".min.js",
      ".min.css",
      ".backup",
      ".bak",
      ".old",
    ];

    return skipPatterns.some((pattern) => normalizedPath.includes(pattern));
  }

  private extractImportsOnly(content: string): string[] {
    const imports: string[] = [];
    const combinedPattern =
      /(?:import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\)|from\s+['"]([^'"]+)['"])/g;

    let match;
    while ((match = combinedPattern.exec(content)) !== null) {
      const importPath = match[1] || match[2] || match[3];
      if (importPath) {
        imports.push(importPath);
      }
    }

    return imports;
  }
}
