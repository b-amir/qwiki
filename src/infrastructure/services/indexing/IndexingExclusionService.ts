import { workspace } from "vscode";
import * as path from "path";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "@/infrastructure/services/logging/LoggingService";
import { VSCodeFileSystemService } from "@/infrastructure/services/filesystem/VSCodeFileSystemService";
import { FilePatterns } from "@/constants";

export class IndexingExclusionService {
  private logger: Logger;
  private initialized = false;
  private workspaceRoot: string | undefined;

  private directoryPatterns: RegExp[] = [];
  private filePatterns: RegExp[] = [];
  private gitignorePatterns: string[] = [];
  private customPatterns: string[] = [];

  private useGitignore = true;

  constructor(
    private loggingService: LoggingService,
    private fileSystemService: VSCodeFileSystemService,
  ) {
    this.logger = createLogger("IndexingExclusionService");
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    const startTime = Date.now();

    const workspaceFolders = workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
      this.workspaceRoot = workspaceFolders[0]?.uri.fsPath;
    }

    this.loadSettings();
    this.compileBuiltInPatterns();

    if (this.useGitignore && this.workspaceRoot) {
      await this.loadGitignorePatterns(this.workspaceRoot);
    }

    this.initialized = true;
    const duration = Date.now() - startTime;

    this.logger.info("IndexingExclusionService initialized", {
      duration,
      directoryPatterns: this.directoryPatterns.length,
      filePatterns: this.filePatterns.length,
      gitignorePatterns: this.gitignorePatterns.length,
      customPatterns: this.customPatterns.length,
      useGitignore: this.useGitignore,
    });
  }

  private loadSettings(): void {
    const config = workspace.getConfiguration("qwiki.indexing");

    this.useGitignore = config.get<boolean>("useGitignore", true);
    this.customPatterns = config.get<string[]>("excludePatterns", []);

    this.logger.debug("Loaded indexing settings", {
      useGitignore: this.useGitignore,
      customPatternCount: this.customPatterns.length,
    });
  }

  private compileBuiltInPatterns(): void {
    for (const pattern of FilePatterns.excludeDirectories) {
      try {
        const regex = this.globToRegex(pattern, true);
        this.directoryPatterns.push(regex);
      } catch (error) {
        this.logger.warn(`Failed to compile directory pattern: ${pattern}`, error);
      }
    }

    for (const pattern of FilePatterns.excludeFilePatterns) {
      try {
        const regex = this.globToRegex(pattern, false);
        this.filePatterns.push(regex);
      } catch (error) {
        this.logger.warn(`Failed to compile file pattern: ${pattern}`, error);
      }
    }
  }

  private globToRegex(pattern: string, isDirectory: boolean): RegExp {
    let regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*\*/g, "{{GLOBSTAR}}")
      .replace(/\*/g, "[^/\\\\]*")
      .replace(/\?/g, "[^/\\\\]")
      .replace(/{{GLOBSTAR}}/g, ".*");

    if (isDirectory) {
      regexPattern = `(^|[/\\\\])${regexPattern}([/\\\\]|$)`;
    } else {
      regexPattern = `(^|[/\\\\])${regexPattern}$`;
    }

    return new RegExp(regexPattern, "i");
  }

  async loadGitignorePatterns(workspaceRoot: string): Promise<void> {
    const gitignorePath = path.join(workspaceRoot, ".gitignore");

    try {
      const content = await this.fileSystemService.readFile(gitignorePath, true);
      const lines = content.split(/\r?\n/);
      const patterns: string[] = [];

      for (const line of lines) {
        const trimmed = line.trim();

        if (!trimmed || trimmed.startsWith("#")) {
          continue;
        }

        if (trimmed.startsWith("!")) {
          continue;
        }

        patterns.push(trimmed);
      }

      this.gitignorePatterns = patterns;

      this.logger.debug("Loaded .gitignore patterns", {
        path: gitignorePath,
        patternCount: patterns.length,
      });
    } catch (error) {
      this.logger.debug("No .gitignore found or failed to read", { workspaceRoot });
      this.gitignorePatterns = [];
    }
  }

  shouldExclude(filePath: string): boolean {
    const normalizedPath = filePath.replace(/\\/g, "/");

    for (const pattern of this.directoryPatterns) {
      if (pattern.test(normalizedPath)) {
        return true;
      }
    }

    for (const pattern of this.filePatterns) {
      if (pattern.test(normalizedPath)) {
        return true;
      }
    }

    if (this.useGitignore && this.gitignorePatterns.length > 0) {
      const relativePath = this.workspaceRoot
        ? normalizedPath.replace(this.workspaceRoot.replace(/\\/g, "/"), "").replace(/^\//, "")
        : normalizedPath;

      for (const pattern of this.gitignorePatterns) {
        if (this.matchGitignorePattern(relativePath, pattern)) {
          return true;
        }
      }
    }

    for (const pattern of this.customPatterns) {
      try {
        const regex = this.globToRegex(pattern, pattern.endsWith("/") || pattern.endsWith("/**"));
        if (regex.test(normalizedPath)) {
          return true;
        }
      } catch {
        // Invalid pattern, skip
      }
    }

    return false;
  }

  private matchGitignorePattern(filePath: string, pattern: string): boolean {
    let p = pattern;

    const isDirectoryPattern = p.endsWith("/");
    if (isDirectoryPattern) {
      p = p.slice(0, -1);
    }

    const isRooted = p.startsWith("/");
    if (isRooted) {
      p = p.slice(1);
    }

    try {
      const regex = this.globToRegex(p, isDirectoryPattern);

      if (isRooted) {
        return regex.test("/" + filePath);
      } else {
        return regex.test(filePath);
      }
    } catch {
      return false;
    }
  }

  getPatternStats(): {
    directoryPatterns: number;
    filePatterns: number;
    gitignorePatterns: number;
    customPatterns: number;
    useGitignore: boolean;
  } {
    return {
      directoryPatterns: this.directoryPatterns.length,
      filePatterns: this.filePatterns.length,
      gitignorePatterns: this.gitignorePatterns.length,
      customPatterns: this.customPatterns.length,
      useGitignore: this.useGitignore,
    };
  }

  async reload(): Promise<void> {
    this.initialized = false;
    this.directoryPatterns = [];
    this.filePatterns = [];
    this.gitignorePatterns = [];
    this.customPatterns = [];
    await this.initialize();
  }
}
