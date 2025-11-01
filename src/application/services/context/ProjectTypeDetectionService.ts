import { workspace } from "vscode";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "../../../infrastructure/services/LoggingService";
import { CachingService } from "../../../infrastructure/services/CachingService";
import { FilePatterns } from "../../../constants";
import { ServiceLimits } from "../../../constants";
import type {
  ProjectTypeDetection,
  ProjectEssentialFile,
} from "../../../domain/entities/ContextIntelligence";

export class ProjectTypeDetectionService {
  private logger: Logger;
  private readonly PROJECT_TYPE_KEY = "context-intelligence:project-type";
  private readonly ESSENTIAL_FILES_KEY = "context-intelligence:essential-files";

  constructor(
    private cachingService: CachingService,
    private loggingService: LoggingService,
  ) {
    this.logger = createLogger("ProjectTypeDetectionService", loggingService);
  }

  private logDebug(message: string, data?: unknown): void {
    this.logger.debug(message, data);
  }

  async detectProjectType(): Promise<ProjectTypeDetection> {
    const cached = await this.cachingService.get<ProjectTypeDetection>(this.PROJECT_TYPE_KEY);
    if (cached) {
      return cached;
    }

    const workspaceFolders = workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return {
        primaryLanguage: "unknown",
        confidence: 0,
      };
    }

    let primaryLanguage = "unknown";
    let framework: string | undefined;
    let buildSystem: string | undefined;
    let packageManager: string | undefined;
    let confidence = 0;

    const indicatorFiles = [
      { pattern: "package.json", language: "javascript", pm: "npm" },
      { pattern: "requirements.txt", language: "python", pm: "pip" },
      { pattern: "pyproject.toml", language: "python", pm: "pip" },
      { pattern: "pom.xml", language: "java", pm: "maven" },
      { pattern: "build.gradle", language: "java", pm: "gradle" },
      { pattern: "Cargo.toml", language: "rust", pm: "cargo" },
      { pattern: "go.mod", language: "go", pm: "go" },
      { pattern: "composer.json", language: "php", pm: "composer" },
      { pattern: "*.csproj", language: "csharp", pm: "dotnet" },
    ];

    for (const indicator of indicatorFiles) {
      try {
        const files = await workspace.findFiles(`**/${indicator.pattern}`, FilePatterns.exclude, 1);
        if (files.length > 0) {
          primaryLanguage = indicator.language;
          packageManager = indicator.pm;
          confidence += 30;

          if (indicator.pattern === "package.json") {
            try {
              const fileUri = files[0];
              const content = await workspace.fs.readFile(fileUri);
              const contentStr = Buffer.from(content).toString("utf8");
              const packageJson = JSON.parse(contentStr);

              if (packageJson.dependencies) {
                const deps = Object.keys(packageJson.dependencies);
                if (deps.includes("react")) framework = "react";
                else if (deps.includes("vue")) framework = "vue";
                else if (deps.includes("@angular/core")) framework = "angular";
                else if (deps.includes("next")) framework = "nextjs";
                if (framework) confidence += 20;
              }

              if (packageJson.devDependencies) {
                if (packageJson.devDependencies.webpack) buildSystem = "webpack";
                else if (packageJson.devDependencies.vite) buildSystem = "vite";
                else if (packageJson.devDependencies.rollup) buildSystem = "rollup";
              }
            } catch (error) {
              this.logDebug("Failed to parse package.json", error);
            }
          }
        }
      } catch (error) {
        this.logDebug(`Failed to check for ${indicator.pattern}`, error);
      }
    }

    confidence = Math.min(100, confidence);

    const detection: ProjectTypeDetection = {
      primaryLanguage,
      framework,
      buildSystem,
      packageManager,
      confidence,
    };

    await this.cachingService.set(this.PROJECT_TYPE_KEY, detection, {
      ttl: ServiceLimits.contextIntelligenceProjectTypeTTL,
    });

    return detection;
  }

  async getLanguageSpecificEssentials(
    projectType: ProjectTypeDetection,
  ): Promise<ProjectEssentialFile[]> {
    const cacheKey = `${this.ESSENTIAL_FILES_KEY}:${projectType.primaryLanguage}`;
    const cached = await this.cachingService.get<ProjectEssentialFile[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const workspaceFolders = workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return [];
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
            const content = await workspace.fs.readFile(fileUri);
            const contentStr = Buffer.from(content).toString("utf8");
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
            const content = await workspace.fs.readFile(fileUri);
            const contentStr = Buffer.from(content).toString("utf8");
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

    await this.cachingService.set(cacheKey, essentials, {
      ttl: ServiceLimits.contextIntelligenceProjectTypeTTL,
    });

    return essentials;
  }

  private estimateTokenCount(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
