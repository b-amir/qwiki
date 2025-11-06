import { workspace } from "vscode";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "../../../infrastructure/services/LoggingService";
import { CachingService } from "../../../infrastructure/services/CachingService";
import { WorkspaceStructureCacheService } from "../../../infrastructure/services/WorkspaceStructureCacheService";
import { VSCodeFileSystemService } from "../../../infrastructure/services/VSCodeFileSystemService";
import { ServiceLimits, FilePatterns } from "../../../constants";
import type { DependencyMap } from "../../../domain/entities/ContextIntelligence";

export class DependencyAnalysisService {
  private logger: Logger;
  private readonly DEPENDENCY_MAP_PREFIX = "context-intelligence:dependency-map:";

  constructor(
    private vscodeFileSystem: VSCodeFileSystemService,
    private cachingService: CachingService,
    private workspaceStructureCache: WorkspaceStructureCacheService,
    private loggingService: LoggingService,
  ) {
    this.logger = createLogger("DependencyAnalysisService");
  }

  async analyzeCodeDependencies(filePath: string): Promise<DependencyMap> {
    const persistentCached = await this.workspaceStructureCache.getDependencyMap(filePath);
    if (persistentCached) {
      const cacheKey = `${this.DEPENDENCY_MAP_PREFIX}${filePath}`;
      await this.cachingService.set(cacheKey, persistentCached, {
        ttl: ServiceLimits.contextIntelligenceFileRelevanceTTL,
      });
      return persistentCached;
    }

    const cacheKey = `${this.DEPENDENCY_MAP_PREFIX}${filePath}`;
    const cached = await this.cachingService.get<DependencyMap>(cacheKey);
    if (cached) {
      return cached;
    }

    let fileContent = "";
    try {
      fileContent = await this.vscodeFileSystem.readFile(filePath, true);
    } catch (error) {
      this.logger.debug(`Failed to read file ${filePath}`, error);
      return { imports: [], exports: [], dependencies: [], dependents: [] };
    }

    const imports = this.extractImportsExports(fileContent);
    const exports: string[] = [];
    const dependencies: string[] = [];

    const workspaceFolders = workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
      const allFiles = await workspace.findFiles(
        FilePatterns.allFiles,
        FilePatterns.exclude,
        ServiceLimits.contextIntelligenceMaxFileAnalysis,
      );

      const candidateNames = new Set<string>();
      for (const imp of imports) {
        const normalized = imp.replace(/['"]/g, "").split("/").pop() || "";
        if (normalized) {
          candidateNames.add(normalized);
        }
      }

      for (const fileUri of allFiles) {
        const candidatePath = fileUri.fsPath;
        if (candidatePath === filePath) continue;

        const fileName = candidatePath
          .split(/[/\\]/)
          .pop()
          ?.replace(/\.[^.]+$/, "");
        if (fileName && candidateNames.has(fileName)) {
          dependencies.push(candidatePath);
        }
      }
    }

    const dependents: string[] = [];
    if (workspaceFolders && workspaceFolders.length > 0) {
      const allFiles = await workspace.findFiles(
        FilePatterns.allFiles,
        FilePatterns.exclude,
        ServiceLimits.contextIntelligenceMaxFileAnalysis,
      );
      const targetFileName = filePath
        .split(/[/\\]/)
        .pop()
        ?.replace(/\.[^.]+$/, "");

      if (targetFileName) {
        const targetNameLower = targetFileName.toLowerCase();

        for (const fileUri of allFiles) {
          const candidatePath = fileUri.fsPath;
          if (candidatePath === filePath) continue;

          try {
            const contentStr = await this.vscodeFileSystem.readFile(candidatePath, true);
            const candidateImports = this.extractImportsExports(contentStr);

            let isDependent = false;
            for (const imp of candidateImports) {
              if (imp.toLowerCase().includes(targetNameLower)) {
                isDependent = true;
                break;
              }
            }

            if (isDependent) {
              dependents.push(candidatePath);
            }
          } catch {
            continue;
          }
        }
      }
    }

    const dependencyMap: DependencyMap = {
      imports,
      exports,
      dependencies,
      dependents,
    };

    await Promise.all([
      this.workspaceStructureCache.setDependencyMap(filePath, dependencyMap),
      this.cachingService.set(cacheKey, dependencyMap, {
        ttl: ServiceLimits.contextIntelligenceFileRelevanceTTL,
      }),
    ]);

    return dependencyMap;
  }

  async findRelatedFiles(filePath: string, maxDepth: number): Promise<string[]> {
    const related = new Set<string>();
    const visited = new Set<string>([filePath]);
    const queue: Array<{ path: string; depth: number }> = [{ path: filePath, depth: 0 }];

    while (queue.length > 0) {
      const { path, depth } = queue.shift()!;
      if (depth >= maxDepth) continue;

      const dependencyMap = await this.analyzeCodeDependencies(path);
      for (const dep of dependencyMap.dependencies) {
        if (!visited.has(dep)) {
          visited.add(dep);
          related.add(dep);
          queue.push({ path: dep, depth: depth + 1 });
        }
      }
    }

    return Array.from(related);
  }

  private extractImportsExports(content: string): string[] {
    const imports: string[] = [];
    const combinedPattern =
      /(?:import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\)|from\s+['"]([^'"]+)['"])/g;

    let match;
    while ((match = combinedPattern.exec(content)) !== null) {
      const importPath = match[1] || match[2] || match[3];
      if (importPath && !importPath.startsWith(".") && !importPath.startsWith("/")) {
        continue;
      }
      if (importPath) {
        imports.push(importPath);
      }
    }

    return imports;
  }
}
