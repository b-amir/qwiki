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
    minRelevanceThreshold: number = 0.1,
  ): Promise<FileRelevanceScore | null> {
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

    const quickScore = await this.quickRelevanceCheck(targetPath, candidatePath);
    if (quickScore !== null && quickScore < minRelevanceThreshold) {
      const lowScore: FileRelevanceScore = {
        filePath: candidatePath,
        score: quickScore * 100,
        relevanceType: "structural",
        tokenCost: 0,
        compressionRatio: 0.3,
        metadata: {
          isDependency: false,
          isImportedBy: [],
          importsFrom: [],
          semanticSimilarity: quickScore,
          lastModified: new Date(),
          complexity: 0,
          fileCategory: this.detectFileCategory(candidatePath),
        },
      };
      await this.cachingService.set(cacheKey, lowScore, {
        ttl: ServiceLimits.contextIntelligenceFileRelevanceTTL,
      });
      return lowScore;
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
    const importScore = await this.calculateImportScore(targetPath, candidatePath);
    const modificationPatternScore = await this.calculateModificationPatternScore(
      targetPath,
      candidatePath,
      lastModified,
    );
    const contentQuality = this.analyzeContentQuality(fileContent, candidatePath);

    const semanticScore = semanticSimilarity * 25;
    const pathScore = pathSimilarity * 15;
    const dependencyScore = isDependency ? 30 : 0;
    const recencyFactor = recencyScore * 5;
    const sizeFactor = fileSizeScore * 5;
    const qualityMultiplier = contentQuality.score;

    const totalScore = Math.min(
      100,
      (semanticScore +
        pathScore +
        dependencyScore +
        importScore +
        recencyFactor +
        sizeFactor +
        modificationPatternScore) *
        qualityMultiplier,
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
    const existingSimilarity = total > 0 ? matches / total : 0;

    const targetIdentifiers = this.extractIdentifiers(content1);
    const candidateIdentifiers = this.extractIdentifiers(content2);

    const intersection = new Set(
      [...targetIdentifiers].filter((id) => candidateIdentifiers.has(id)),
    );
    const union = new Set([...targetIdentifiers, ...candidateIdentifiers]);
    const jaccardSimilarity = union.size > 0 ? intersection.size / union.size : 0;

    const weightedSimilarity = this.weightIdentifiers(
      targetIdentifiers,
      candidateIdentifiers,
      intersection,
    );

    return existingSimilarity * 0.7 + weightedSimilarity * 0.3;
  }

  private extractIdentifiers(content: string): Set<string> {
    const identifiers = new Set<string>();

    const functionPattern = /(?:function|const|let|var|async\s+function)\s+(\w+)/g;
    const classPattern = /class\s+(\w+)/g;
    const exportPattern =
      /export\s+(?:default\s+)?(?:function|class|const|let|var|interface|type|enum)\s+(\w+)/g;
    const importPattern = /import\s+(?:\{[^}]*\}|\*\s+as\s+(\w+)|\w+)\s+from/g;
    const methodPattern = /(?:public|private|protected)?\s*(?:async\s+)?(\w+)\s*\(/g;
    const variablePattern = /(?:const|let|var)\s+(\w+)\s*[:=]/g;

    let match;
    while ((match = functionPattern.exec(content)) !== null) {
      if (match[1] && match[1].length >= 2) {
        identifiers.add(match[1]);
      }
    }
    while ((match = classPattern.exec(content)) !== null) {
      if (match[1] && match[1].length >= 2) {
        identifiers.add(match[1]);
      }
    }
    while ((match = exportPattern.exec(content)) !== null) {
      if (match[1] && match[1].length >= 2) {
        identifiers.add(match[1]);
      }
    }
    while ((match = importPattern.exec(content)) !== null) {
      if (match[1] && match[1].length >= 2) {
        identifiers.add(match[1]);
      }
    }
    while ((match = methodPattern.exec(content)) !== null) {
      if (match[1] && match[1].length >= 2) {
        identifiers.add(match[1]);
      }
    }
    while ((match = variablePattern.exec(content)) !== null) {
      if (match[1] && match[1].length >= 2) {
        identifiers.add(match[1]);
      }
    }

    return identifiers;
  }

  private weightIdentifiers(
    targetIdentifiers: Set<string>,
    candidateIdentifiers: Set<string>,
    intersection: Set<string>,
  ): number {
    if (intersection.size === 0) {
      return 0;
    }

    let weightedScore = 0;
    const targetExports = this.extractExports(targetIdentifiers);
    const candidateExports = this.extractExports(candidateIdentifiers);

    for (const id of intersection) {
      let weight = 1.0;
      if (targetExports.has(id) || candidateExports.has(id)) {
        weight = 3.0;
      } else if (
        this.isImportIdentifier(id, targetIdentifiers) ||
        this.isImportIdentifier(id, candidateIdentifiers)
      ) {
        weight = 2.0;
      }
      weightedScore += weight;
    }

    const maxPossibleScore = Math.max(targetIdentifiers.size, candidateIdentifiers.size) * 3.0;
    return maxPossibleScore > 0 ? weightedScore / maxPossibleScore : 0;
  }

  private extractExports(identifiers: Set<string>): Set<string> {
    return identifiers;
  }

  private isImportIdentifier(identifier: string, identifiers: Set<string>): boolean {
    return identifiers.has(identifier);
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

  private async calculateImportScore(targetPath: string, candidatePath: string): Promise<number> {
    const isDirectImport = await this.dependencyAnalysisService.isFileDependentOn(
      candidatePath,
      targetPath,
    );

    if (isDirectImport) {
      return 20;
    }

    const isTransitiveImport = await this.isTransitivelyDependentOn(candidatePath, targetPath);

    if (isTransitiveImport) {
      return 10;
    }

    return 0;
  }

  private async isTransitivelyDependentOn(
    candidatePath: string,
    targetPath: string,
    visited: Set<string> = new Set(),
    maxDepth: number = 3,
  ): Promise<boolean> {
    if (maxDepth === 0 || visited.has(candidatePath)) {
      return false;
    }

    visited.add(candidatePath);

    const dependencyMap =
      await this.dependencyAnalysisService.analyzeCodeDependencies(candidatePath);

    for (const dependency of dependencyMap.dependencies) {
      if (dependency === targetPath) {
        return true;
      }

      const isTransitive = await this.isTransitivelyDependentOn(
        dependency,
        targetPath,
        new Set(visited),
        maxDepth - 1,
      );

      if (isTransitive) {
        return true;
      }
    }

    return false;
  }

  private async calculateModificationPatternScore(
    targetPath: string,
    candidatePath: string,
    candidateLastModified: Date,
  ): Promise<number> {
    try {
      const targetStat = await this.vscodeFileSystem.stat(targetPath);
      const targetLastModified = targetStat.mtime ? new Date(targetStat.mtime) : new Date();

      const timeDiff = Math.abs(targetLastModified.getTime() - candidateLastModified.getTime());
      const hoursDiff = timeDiff / (1000 * 60 * 60);

      if (hoursDiff < 24) {
        return 5;
      }
      if (hoursDiff < 168) {
        return 2;
      }
      return 0;
    } catch {
      return 0;
    }
  }

  private calculateRecencyScore(lastModified: Date): number {
    const now = Date.now();
    const modified = lastModified.getTime();
    const daysSinceModified = (now - modified) / (1000 * 60 * 60 * 24);

    if (daysSinceModified < 1) return 1.0;
    if (daysSinceModified < 7) return Math.exp(-daysSinceModified / 7);
    if (daysSinceModified < 30) return Math.exp(-daysSinceModified / 30) * 0.5;
    return Math.exp(-daysSinceModified / 90) * 0.1;
  }

  private calculateFileSizeScore(fileSize: number): number {
    if (fileSize < 100) return 0.2;
    if (fileSize < 1000) return 0.5;
    if (fileSize < 10000) return 1.0;
    if (fileSize < 50000) return 0.7;
    return 0.3;
  }

  private async quickRelevanceCheck(
    targetPath: string,
    candidatePath: string,
  ): Promise<number | null> {
    const pathSimilarity = this.calculatePathSimilarity(targetPath, candidatePath);
    const isDependency = await this.isDependencyFile(candidatePath);

    if (isDependency) {
      return 0.3;
    }

    if (pathSimilarity > 0.5) {
      return pathSimilarity;
    }

    const targetDir = targetPath.substring(
      0,
      targetPath.lastIndexOf("/") || targetPath.lastIndexOf("\\"),
    );
    const candidateDir = candidatePath.substring(
      0,
      candidatePath.lastIndexOf("/") || candidatePath.lastIndexOf("\\"),
    );

    if (targetDir === candidateDir) {
      return 0.4;
    }

    if (pathSimilarity < 0.1) {
      return pathSimilarity;
    }

    return null;
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

  private analyzeContentQuality(
    content: string,
    filePath: string,
  ): {
    score: number;
    isGenerated: boolean;
    isMinified: boolean;
    codeRatio: number;
  } {
    const isMinified = this.detectMinified(content);
    const isGenerated = this.detectGeneratedCode(content, filePath);
    const isTestFile = this.isTestFile(filePath);

    const lines = content.split("\n");
    let codeLines = 0;
    let commentLines = 0;
    let emptyLines = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length === 0) {
        emptyLines++;
        continue;
      }
      if (
        trimmed.startsWith("//") ||
        trimmed.startsWith("/*") ||
        trimmed.startsWith("*") ||
        trimmed.startsWith("#") ||
        trimmed.startsWith("<!--")
      ) {
        commentLines++;
      } else {
        codeLines++;
      }
    }

    const totalNonEmptyLines = codeLines + commentLines;
    const codeRatio = totalNonEmptyLines > 0 ? codeLines / totalNonEmptyLines : 0;

    let score = 1.0;
    if (isMinified) score *= 0.1;
    if (isGenerated) score *= 0.3;
    if (codeRatio < 0.1) score *= 0.5;
    if (codeRatio > 0.9) score *= 1.2;
    if (isTestFile && !filePath.includes("test")) {
      score *= 0.7;
    }

    return { score: Math.max(0, Math.min(1.0, score)), isGenerated, isMinified, codeRatio };
  }

  private detectMinified(content: string): boolean {
    if (content.length === 0) return false;

    const lines = content.split("\n");
    if (lines.length < 3) return false;

    const avgLineLength = content.length / lines.length;
    const longLines = lines.filter((line) => line.length > 200).length;
    const longLineRatio = longLines / lines.length;

    return avgLineLength > 150 || longLineRatio > 0.5;
  }

  private detectGeneratedCode(content: string, filePath: string): boolean {
    const generatedPatterns = [
      /generated by|auto-generated|do not edit|@generated/i,
      /This file was generated/i,
      /DO NOT MODIFY/i,
      /AUTO-GENERATED/i,
    ];

    if (generatedPatterns.some((pattern) => pattern.test(content))) {
      return true;
    }

    const generatedFilePatterns = [
      /\.generated\./i,
      /\.g\.ts$/i,
      /\.pb\.ts$/i,
      /\.pb\.js$/i,
      /\.gen\./i,
    ];

    return generatedFilePatterns.some((pattern) => pattern.test(filePath));
  }

  private isTestFile(filePath: string): boolean {
    const testPatterns = [
      /\.test\./i,
      /\.spec\./i,
      /test\//i,
      /tests\//i,
      /__tests__\//i,
      /\.test\.ts$/i,
      /\.test\.js$/i,
      /\.spec\.ts$/i,
      /\.spec\.js$/i,
    ];

    return testPatterns.some((pattern) => pattern.test(filePath));
  }
}
