import { workspace, Uri } from "vscode";
import { extensions } from "vscode";
import type { GitExtension, GitAPI, Repository } from "@/infrastructure/types/git";
import { GitChangeDetectionService } from "@/infrastructure/services";
import { LoggingService, createLogger, type Logger } from "@/infrastructure/services";
import { Extension } from "@/constants/Extension";
import { VSCodeFileSystemService } from "@/infrastructure/services";
import { ReadmeContentAnalysisService } from "@/application/services/readme/ReadmeContentAnalysisService";

export enum ReadmeState {
  NON_EXISTENT = "non_existent",
  BOILERPLATE = "boilerplate",
  USER_CONTRIBUTED = "user_contributed",
  AUTO_GENERATED = "auto_generated",
}

export interface ReadmeStateResult {
  state: ReadmeState;
  confidence: number;
  signals: {
    exists: boolean;
    isTracked: boolean;
    commitCount: number;
    lastModifiedBy?: string;
    lastModifiedDate?: Date;
    hasCustomContent: boolean;
  };
}

export class ReadmeStateDetectionService {
  private logger: Logger;
  private gitAPI: GitAPI | undefined;

  constructor(
    private vscodeFileSystem: VSCodeFileSystemService,
    private gitChangeDetectionService: GitChangeDetectionService,
    private loggingService: LoggingService,
    private contentAnalysisService?: ReadmeContentAnalysisService,
  ) {
    this.logger = createLogger("ReadmeStateDetectionService");
    this.initializeGitAPI();
  }

  private async initializeGitAPI(): Promise<void> {
    try {
      const gitExtension = extensions.getExtension<GitExtension>(Extension.gitExtensionId);
      if (!gitExtension) {
        this.logger.debug("Git extension not found");
        return;
      }

      if (!gitExtension.isActive) {
        await gitExtension.activate();
      }

      const api = gitExtension.exports.getAPI(1);
      if (!api) {
        this.logger.debug("Git API not available");
        return;
      }

      this.gitAPI = api;
      this.logger.debug("Git API initialized");
    } catch (error) {
      this.logger.error("Failed to initialize Git API", error);
    }
  }

  async detectReadmeState(readmePath: string): Promise<ReadmeStateResult> {
    this.logger.debug("Detecting README state", { readmePath });

    const readmeUri = Uri.file(readmePath);
    const exists = await this.fileExists(readmeUri);
    const isTracked = await this.isFileTracked(readmeUri);

    if (!exists) {
      return {
        state: ReadmeState.NON_EXISTENT,
        confidence: 1.0,
        signals: {
          exists: false,
          isTracked: false,
          commitCount: 0,
          hasCustomContent: false,
        },
      };
    }

    const gitAnalysis = await this.analyzeGitHistory(readmeUri);
    const contentAnalysis = await this.analyzeContent(readmeUri);
    const fullContentAnalysis = await this.getFullContentAnalysis(readmeUri);

    const state = this.determineState(gitAnalysis, fullContentAnalysis);

    return {
      state,
      confidence: this.calculateConfidence(gitAnalysis, fullContentAnalysis),
      signals: {
        exists: true,
        isTracked: gitAnalysis.isTracked,
        commitCount: gitAnalysis.commitCount,
        lastModifiedBy: gitAnalysis.lastModifiedBy,
        lastModifiedDate: gitAnalysis.lastModifiedDate,
        hasCustomContent: fullContentAnalysis.hasCustomContent,
      },
    };
  }

  private async fileExists(uri: Uri): Promise<boolean> {
    try {
      return await this.vscodeFileSystem.fileExists(uri.fsPath);
    } catch {
      return false;
    }
  }

  private async isFileTracked(uri: Uri): Promise<boolean> {
    if (!this.gitAPI || this.gitAPI.repositories.length === 0) {
      return false;
    }

    const repo = this.findRepositoryForUri(uri);
    if (!repo) {
      return false;
    }

    try {
      const changes = [
        ...(repo.state.workingTreeChanges || []),
        ...(repo.state.indexChanges || []),
      ];
      return changes.some((change) => change.uri.fsPath === uri.fsPath);
    } catch {
      try {
        return await this.vscodeFileSystem.fileExists(uri.fsPath);
      } catch {
        return false;
      }
    }
  }

  private async analyzeGitHistory(uri: Uri): Promise<{
    isTracked: boolean;
    commitCount: number;
    lastModifiedBy?: string;
    lastModifiedDate?: Date;
    hasQwikiCommits: boolean;
  }> {
    if (!this.gitAPI || this.gitAPI.repositories.length === 0) {
      return {
        isTracked: false,
        commitCount: 0,
        hasQwikiCommits: false,
      };
    }

    const repo = this.findRepositoryForUri(uri);
    if (!repo) {
      return {
        isTracked: false,
        commitCount: 0,
        hasQwikiCommits: false,
      };
    }

    try {
      const stat = await this.vscodeFileSystem.stat(uri.fsPath);
      const lastModifiedDate = stat.mtime ? new Date(stat.mtime) : undefined;

      const changes = [
        ...(repo.state.workingTreeChanges || []),
        ...(repo.state.indexChanges || []),
      ];
      const hasRecentChanges = changes.some((change) => change.uri.fsPath === uri.fsPath);

      let commitCount = 0;
      try {
        const relativePath = this.getRelativePath(uri, repo.rootUri.fsPath);
        if (hasRecentChanges) {
          commitCount = 1;
        } else {
          commitCount = 1;
        }
      } catch (error) {
        this.logger.debug("Could not get git commit count, using fallback", { error });
        commitCount = 0;
      }

      const qwikiCommitPattern = /qwiki|readme.*update|auto.*generat/i;
      let hasQwikiCommits = false;

      if (lastModifiedDate) {
        const daysSinceModified = (Date.now() - lastModifiedDate.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceModified < 7) {
          hasQwikiCommits = qwikiCommitPattern.test(uri.fsPath);
        }
      }

      return {
        isTracked: true,
        commitCount,
        lastModifiedDate,
        hasQwikiCommits,
      };
    } catch (error) {
      this.logger.debug("Failed to analyze git history", error);
      return {
        isTracked: false,
        commitCount: 0,
        hasQwikiCommits: false,
      };
    }
  }

  private async analyzeContent(uri: Uri): Promise<{
    hasCustomContent: boolean;
  }> {
    try {
      const text = await this.vscodeFileSystem.readFile(uri.fsPath, true);

      const hasCustomContent = this.hasNonBoilerplateContent(text);

      return { hasCustomContent };
    } catch {
      return { hasCustomContent: false };
    }
  }

  private async getFullContentAnalysis(uri: Uri): Promise<{
    hasCustomContent: boolean;
    isUserContributed: boolean;
    score: number;
  }> {
    try {
      const text = await this.vscodeFileSystem.readFile(uri.fsPath, true);

      if (this.contentAnalysisService) {
        const analysis = this.contentAnalysisService.analyze(text);
        return {
          hasCustomContent:
            analysis.score > 0.3 || analysis.hasCodeExamples || analysis.customSections.length > 0,
          isUserContributed: analysis.isUserContributed,
          score: analysis.score,
        };
      }

      const hasCustomContent = this.hasNonBoilerplateContent(text);
      const score = this.calculateContentScore(text);
      const isUserContributed = score > 0.7;

      return { hasCustomContent, isUserContributed, score };
    } catch {
      return { hasCustomContent: false, isUserContributed: false, score: 0 };
    }
  }

  private calculateContentScore(text: string): number {
    if (text.trim().length < 100) return 0;

    let score = 0.5;
    const customIndicators = [
      /TODO|FIXME|NOTE:/i,
      /\w+@\w+\.\w+/,
      /https?:\/\//,
      /\{.*\}/,
      /```[\s\S]{50,}```/,
    ];

    const customCount = customIndicators.filter((p) => p.test(text)).length;
    score += customCount * 0.1;

    const genericSections = /#{1,2}\s+(Installation|Usage|Contributing|License)/gi;
    const genericCount = (text.match(genericSections) || []).length;
    score -= genericCount * 0.1;

    return Math.min(Math.max(score, 0), 1);
  }

  private hasNonBoilerplateContent(text: string): boolean {
    if (text.trim().length < 100) {
      return false;
    }

    const customIndicators = [
      /TODO|FIXME|NOTE:/i,
      /\w+@\w+\.\w+/,
      /https?:\/\//,
      /\{.*\}/,
      /```[\s\S]{50,}```/,
    ];

    const customIndicatorCount = customIndicators.filter((pattern) => pattern.test(text)).length;

    const genericSectionPattern = /#{1,2}\s+(Installation|Usage|Contributing|License)/gi;
    const genericSectionMatches = text.match(genericSectionPattern);
    const genericSectionCount = genericSectionMatches ? genericSectionMatches.length : 0;

    return customIndicatorCount >= 2 || (customIndicatorCount >= 1 && genericSectionCount < 2);
  }

  private determineState(
    gitAnalysis: {
      commitCount: number;
      hasQwikiCommits: boolean;
    },
    contentAnalysis: {
      hasCustomContent: boolean;
      isUserContributed: boolean;
      score: number;
    },
  ): ReadmeState {
    if (contentAnalysis.isUserContributed) {
      return ReadmeState.USER_CONTRIBUTED;
    }

    if (
      gitAnalysis.commitCount === 0 &&
      !contentAnalysis.hasCustomContent &&
      contentAnalysis.score < 0.3
    ) {
      return ReadmeState.NON_EXISTENT;
    }

    if (gitAnalysis.commitCount === 1 && gitAnalysis.hasQwikiCommits) {
      return ReadmeState.AUTO_GENERATED;
    }

    if (gitAnalysis.commitCount >= 3 && contentAnalysis.hasCustomContent) {
      return ReadmeState.USER_CONTRIBUTED;
    }

    if (gitAnalysis.hasQwikiCommits && !contentAnalysis.hasCustomContent) {
      return ReadmeState.AUTO_GENERATED;
    }

    if (contentAnalysis.hasCustomContent && contentAnalysis.score > 0.5) {
      return ReadmeState.USER_CONTRIBUTED;
    }

    return ReadmeState.BOILERPLATE;
  }

  private calculateConfidence(
    gitAnalysis: {
      commitCount: number;
      hasQwikiCommits: boolean;
    },
    contentAnalysis: {
      hasCustomContent: boolean;
      isUserContributed: boolean;
      score: number;
    },
  ): number {
    let confidence = 0.5;

    if (
      gitAnalysis.commitCount === 0 &&
      !contentAnalysis.hasCustomContent &&
      contentAnalysis.score < 0.3
    ) {
      return 1.0;
    }

    if (contentAnalysis.isUserContributed) {
      confidence += 0.3;
    }

    if (gitAnalysis.commitCount >= 3) {
      confidence += 0.3;
    }

    if (contentAnalysis.hasCustomContent) {
      confidence += 0.2;
    }

    if (gitAnalysis.hasQwikiCommits && !contentAnalysis.hasCustomContent) {
      confidence += 0.2;
    }

    return Math.min(confidence, 1.0);
  }

  private findRepositoryForUri(uri: Uri): Repository | undefined {
    if (!this.gitAPI) {
      return undefined;
    }

    return this.gitAPI.repositories.find((repo: any) => uri.fsPath.startsWith(repo.rootUri.fsPath));
  }

  private getRelativePath(uri: Uri, rootPath: string): string {
    const fullPath = uri.fsPath;
    if (fullPath.startsWith(rootPath)) {
      return fullPath.substring(rootPath.length + 1);
    }
    return fullPath;
  }
}
