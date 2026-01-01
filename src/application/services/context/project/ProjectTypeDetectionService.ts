import * as path from "path";
import { workspace } from "vscode";
import { LoggingService, createLogger, type Logger } from "@/infrastructure/services";
import { CachingService } from "@/infrastructure/services";
import { WorkspaceStructureCacheService } from "@/infrastructure/services/caching/WorkspaceStructureCacheService";
import { VSCodeFileSystemService } from "@/infrastructure/services/filesystem/VSCodeFileSystemService";
import { FilePatterns } from "@/constants";
import { ServiceLimits } from "@/constants";
import type {
  ProjectTypeDetection,
  ProjectEssentialFile,
} from "@/domain/entities/ContextIntelligence";

export class ProjectTypeDetectionService {
  private logger: Logger;

  constructor(
    private vscodeFileSystem: VSCodeFileSystemService,
    private cachingService: CachingService,
    private workspaceStructureCache: WorkspaceStructureCacheService,
    private loggingService: LoggingService,
  ) {
    this.logger = createLogger("ProjectTypeDetectionService");
  }

  private logDebug(message: string, data?: unknown): void {
    this.logger.debug(message, data);
  }

  async detectProjectType(): Promise<ProjectTypeDetection> {
    const workspaceFolders = workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return {
        primaryLanguage: "unknown",
        confidence: 0,
      };
    }

    const rootFolder = workspaceFolders[0];
    if (!rootFolder) {
      return {
        primaryLanguage: "unknown",
        confidence: 0,
      };
    }

    const workspaceRoot = rootFolder.uri.fsPath;
    const cached = await this.workspaceStructureCache.getProjectType(workspaceRoot);
    if (cached) {
      this.logger.debug("Using cached project type");
      return cached;
    }

    // Use weighted scoring to determine project type
    const scores = new Map<
      string,
      { score: number; framework?: string; buildSystem?: string; pm?: string }
    >();

    // Phase 1: Check ROOT config files only (highest priority)
    const rootConfigs = [
      { file: "package.json", language: "javascript", pm: "npm" },
      { file: "tsconfig.json", language: "typescript", pm: "npm" },
      { file: "pyproject.toml", language: "python", pm: "pip" },
      { file: "requirements.txt", language: "python", pm: "pip" },
      { file: "Cargo.toml", language: "rust", pm: "cargo" },
      { file: "go.mod", language: "go", pm: "go" },
      { file: "pom.xml", language: "java", pm: "maven" },
      { file: "build.gradle", language: "java", pm: "gradle" },
      { file: "composer.json", language: "php", pm: "composer" },
    ];

    for (const config of rootConfigs) {
      const exists = await this.fileExistsAtRoot(workspaceRoot, config.file);
      this.logger.debug(`Root config check: ${config.file}`, { exists, workspaceRoot });

      if (exists) {
        const existing = scores.get(config.language) || { score: 0, pm: config.pm };
        existing.score += 50; // Root config = 50 points
        existing.pm = config.pm;
        scores.set(config.language, existing);

        // Special handling for package.json to detect framework and TypeScript
        if (config.file === "package.json") {
          await this.analyzePackageJson(workspaceRoot, scores);
        }
      }
    }

    // Phase 2: If no root config found, scan for files in subdirectories (lower weight)
    if (scores.size === 0) {
      const fallbackIndicators = [
        { pattern: "package.json", language: "javascript", pm: "npm" },
        { pattern: "requirements.txt", language: "python", pm: "pip" },
        { pattern: "Cargo.toml", language: "rust", pm: "cargo" },
      ];

      for (const indicator of fallbackIndicators) {
        try {
          const files = await workspace.findFiles(
            `**/${indicator.pattern}`,
            FilePatterns.exclude,
            1,
          );
          if (files.length > 0) {
            const existing = scores.get(indicator.language) || { score: 0, pm: indicator.pm };
            existing.score += 20; // Subdirectory config = only 20 points
            existing.pm = indicator.pm;
            scores.set(indicator.language, existing);
          }
        } catch (error) {
          this.logDebug(`Failed to check for ${indicator.pattern}`, error);
        }
      }
    }

    // Select winner with highest score
    let winner: {
      language: string;
      score: number;
      framework?: string;
      buildSystem?: string;
      pm?: string;
    } | null = null;
    for (const [language, data] of scores) {
      if (!winner || data.score > winner.score) {
        winner = { language, ...data };
      }
    }

    const detection: ProjectTypeDetection = {
      primaryLanguage: winner?.language ?? "unknown",
      framework: winner?.framework,
      buildSystem: winner?.buildSystem,
      packageManager: winner?.pm,
      confidence: Math.min(winner?.score ?? 0, 100),
    };

    this.logger.debug("Project type detected with weighted scoring", {
      primaryLanguage: detection.primaryLanguage,
      framework: detection.framework,
      confidence: detection.confidence,
      allScores: Object.fromEntries(scores),
    });

    await this.workspaceStructureCache.setProjectType(
      workspaceRoot,
      detection,
      ServiceLimits.contextIntelligenceProjectTypeTTL,
    );

    return detection;
  }

  private async fileExistsAtRoot(rootPath: string, filename: string): Promise<boolean> {
    try {
      const filePath = path.join(rootPath, filename);
      await this.vscodeFileSystem.stat(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async analyzePackageJson(
    rootPath: string,
    scores: Map<string, { score: number; framework?: string; buildSystem?: string; pm?: string }>,
  ): Promise<void> {
    try {
      const pkgPath = path.join(rootPath, "package.json");
      const contentStr = await this.vscodeFileSystem.readFile(pkgPath, true);
      const pkg = JSON.parse(contentStr);
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

      // Check for TypeScript - upgrades JavaScript to TypeScript
      const hasTypeScript =
        allDeps.typescript || (await this.fileExistsAtRoot(rootPath, "tsconfig.json"));
      if (hasTypeScript) {
        const tsScore = scores.get("typescript") || { score: 0, pm: "npm" };
        tsScore.score += 40; // TypeScript bonus

        // Merge JavaScript score into TypeScript
        const jsScore = scores.get("javascript");
        if (jsScore) {
          tsScore.score += jsScore.score;
          tsScore.framework = jsScore.framework;
          tsScore.buildSystem = jsScore.buildSystem;
          scores.delete("javascript");
        }
        scores.set("typescript", tsScore);
      }

      // Detect framework
      let framework: string | undefined;
      if (allDeps.react || allDeps["react-dom"]) framework = "react";
      else if (allDeps.vue || allDeps["@vue/core"]) framework = "vue";
      else if (allDeps["@angular/core"]) framework = "angular";
      else if (allDeps.next) framework = "nextjs";
      else if (allDeps.svelte) framework = "svelte";

      if (framework) {
        const lang = hasTypeScript ? "typescript" : "javascript";
        const entry = scores.get(lang);
        if (entry) {
          entry.framework = framework;
          entry.score += 30; // Framework bonus
        }
      }

      // Detect build system
      let buildSystem: string | undefined;
      if (allDeps.vite) buildSystem = "vite";
      else if (allDeps.webpack) buildSystem = "webpack";
      else if (allDeps.rollup) buildSystem = "rollup";
      else if (allDeps.esbuild) buildSystem = "esbuild";

      if (buildSystem) {
        const lang = hasTypeScript ? "typescript" : "javascript";
        const entry = scores.get(lang);
        if (entry) {
          entry.buildSystem = buildSystem;
        }
      }
    } catch (error) {
      this.logDebug("Failed to analyze package.json", error);
    }
  }

  async getLanguageSpecificEssentials(
    projectType: ProjectTypeDetection,
  ): Promise<ProjectEssentialFile[]> {
    const workspaceFolders = workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return [];
    }

    const rootFolder = workspaceFolders[0];
    if (!rootFolder) return [];

    const workspaceRoot = rootFolder.uri.fsPath;
    const cached = await this.workspaceStructureCache.getEssentialFiles(workspaceRoot);
    if (cached) {
      this.logger.debug("Using cached essential files");
      return cached;
    }

    const essentials: ProjectEssentialFile[] = [];

    if (
      projectType.primaryLanguage === "javascript" ||
      projectType.primaryLanguage === "typescript"
    ) {
      const essentialFiles = [
        { path: "package.json", priority: "critical" as const, type: "package-manager" as const },
        { path: "tsconfig.json", priority: "high" as const, type: "config" as const },
        { path: ".env.example", priority: "medium" as const, type: "env" as const },
        { path: "webpack.config.js", priority: "medium" as const, type: "build" as const },
        { path: "vite.config.ts", priority: "medium" as const, type: "build" as const },
      ];

      for (const essential of essentialFiles) {
        try {
          const files = await workspace.findFiles(`**/${essential.path}`, FilePatterns.exclude, 1);
          if (files.length > 0) {
            const fileUri = files[0];
            if (!fileUri) continue;
            const contentStr = await this.vscodeFileSystem.readFile(fileUri.fsPath, true);
            const tokenCost = this.estimateTokenCount(contentStr);

            essentials.push({
              filePath: fileUri.fsPath,
              priority: essential.priority,
              contentType: essential.type,
              tokenCost,
              compressionStrategy: "light",
            });
          }
        } catch (error) {
          this.logDebug(`Failed to find essential file ${essential.path}`, error);
        }
      }
    } else if (projectType.primaryLanguage === "python") {
      const essentialFiles = [
        {
          path: "requirements.txt",
          priority: "critical" as const,
          type: "package-manager" as const,
        },
        { path: "pyproject.toml", priority: "critical" as const, type: "package-manager" as const },
        { path: "setup.py", priority: "high" as const, type: "config" as const },
        { path: ".env", priority: "medium" as const, type: "env" as const },
      ];

      for (const essential of essentialFiles) {
        try {
          const files = await workspace.findFiles(`**/${essential.path}`, FilePatterns.exclude, 1);
          if (files.length > 0) {
            const fileUri = files[0];
            if (!fileUri) continue;
            const contentStr = await this.vscodeFileSystem.readFile(fileUri.fsPath, true);
            const tokenCost = this.estimateTokenCount(contentStr);

            essentials.push({
              filePath: fileUri.fsPath,
              priority: essential.priority,
              contentType: essential.type,
              tokenCost,
              compressionStrategy: "light",
            });
          }
        } catch (error) {
          this.logDebug(`Failed to find essential file ${essential.path}`, error);
        }
      }
    }

    await this.workspaceStructureCache.setEssentialFiles(
      workspaceRoot,
      essentials,
      ServiceLimits.contextIntelligenceProjectTypeTTL,
    );

    return essentials;
  }

  private estimateTokenCount(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
