import type { LLMRegistry } from "../../llm";
import type { WikiGenerationRequest, WikiGenerationResult } from "../../domain/entities/Wiki";
import type { ProjectContext } from "../../domain/entities/Selection";
import { LoadingSteps } from "../../constants/Events";
import type { LoadingStep } from "../../constants/Events";
import { ErrorCodes, ErrorMessages } from "../../constants";
import type { ProviderId } from "../../llm/types";
import { WikiError } from "../../errors";
import { GenerationCacheService } from "../../infrastructure/services/GenerationCacheService";
import { RequestBatchingService } from "../../infrastructure/services/RequestBatchingService";
import { DebouncingService } from "../../infrastructure/services/DebouncingService";
import {
  BackgroundProcessingService,
  TaskPriority,
} from "../../infrastructure/services/BackgroundProcessingService";
import { MemoryOptimizationService } from "../../infrastructure/services/MemoryOptimizationService";

type SnippetAnalysis = {
  languageId?: string;
  lineCount: number;
  nonEmptyLineCount: number;
  characterCount: number;
  symbols: string[];
};

type ContextSummary = {
  relatedCount: number;
  relatedPaths: string[];
  hasOverview: boolean;
  hasRootName: boolean;
  filesSample: string[];
};

type GenerationMetadata = {
  analysis: SnippetAnalysis;
  context: ContextSummary;
};

type GenerationInput = {
  snippet: string;
  project: ProjectContext;
  metadata: GenerationMetadata;
};

type ProcessedGeneration = {
  content: string;
  metrics: {
    headingCount: number;
    listCount: number;
    paragraphCount: number;
    promptSeedLength: number;
  };
};

export class WikiService {
  private debouncedGenerate: any;
  private generationCacheKeyPrefix = "wiki_generation";

  constructor(
    private llmRegistry: LLMRegistry,
    private generationCacheService: GenerationCacheService,
    private requestBatchingService: RequestBatchingService,
    private debouncingService: DebouncingService,
    private backgroundProcessingService: BackgroundProcessingService,
    private memoryOptimizationService: MemoryOptimizationService,
  ) {
    this.debouncedGenerate = this.debouncingService.debounce(
      this.performGeneration.bind(this),
      300,
      { leading: false, trailing: true },
    );
  }

  async generateWiki(
    request: WikiGenerationRequest,
    projectContext: ProjectContext,
    onProgress?: (step: LoadingStep) => void,
  ): Promise<WikiGenerationResult> {
    try {
      onProgress?.(LoadingSteps.validating);

      if (!request.snippet?.trim()) {
        throw new WikiError("missingSnippet", ErrorMessages[ErrorCodes.missingSnippet]);
      }

      const generateParams = {
        snippet: request.snippet,
        languageId: request.languageId,
        filePath: request.filePath,
        model: request.model,
        project: projectContext,
      };

      const cachedResult = await this.generationCacheService.getCachedGeneration(generateParams);
      if (cachedResult) {
        onProgress?.(LoadingSteps.processing);
        onProgress?.(LoadingSteps.finalizing);
        return {
          content: cachedResult.content,
          success: true,
        };
      }

      if (request.snippet.length > 10000) {
        return this.backgroundProcessingService.enqueueTask(
          `generate-wiki-${Date.now()}`,
          () => this.performLargeGeneration(request, projectContext, generateParams, onProgress),
          TaskPriority.HIGH,
        ) as any;
      }

      return this.performGeneration(request, projectContext, generateParams, onProgress);
    } catch (error: any) {
      return {
        content: "",
        success: false,
        error: error?.message || ErrorMessages[ErrorCodes.generationFailed],
      };
    }
  }

  private async performGeneration(
    request: WikiGenerationRequest,
    projectContext: ProjectContext,
    generateParams: {
      snippet: string;
      languageId?: string;
      filePath?: string;
      model?: string;
      project: ProjectContext;
    },
    onProgress?: (step: LoadingStep) => void,
  ): Promise<WikiGenerationResult> {
    return this.requestBatchingService.batchRequest(
      async () => {
        return this.executeGenerationFlow(request, projectContext, generateParams, onProgress);
      },
      {
        maxBatchSize: 5,
        maxWaitTime: 100,
        deduplicationKey: `${this.generationCacheKeyPrefix}_${request.snippet.substring(0, 100)}`,
      },
    );
  }

  private async performLargeGeneration(
    request: WikiGenerationRequest,
    projectContext: ProjectContext,
    generateParams: {
      snippet: string;
      languageId?: string;
      filePath?: string;
      model?: string;
      project: ProjectContext;
    },
    onProgress?: (step: LoadingStep) => void,
  ): Promise<WikiGenerationResult> {
    await this.memoryOptimizationService.optimizeMemory();
    const result = await this.executeGenerationFlow(
      request,
      projectContext,
      generateParams,
      onProgress,
    );
    await this.memoryOptimizationService.optimizeMemory();
    return result;
  }

  private async executeGenerationFlow(
    request: WikiGenerationRequest,
    projectContext: ProjectContext,
    generateParams: {
      snippet: string;
      languageId?: string;
      filePath?: string;
      model?: string;
      project: ProjectContext;
    },
    onProgress?: (step: LoadingStep) => void,
  ): Promise<WikiGenerationResult> {
    const analysis = this.analyzeSnippet(request.snippet, request.languageId);
    onProgress?.(LoadingSteps.analyzing);
    await this.yieldForUi();

    const contextSummary = this.summarizeContext(projectContext);
    onProgress?.(LoadingSteps.finding);
    await this.yieldForUi();

    const generationInput = this.prepareGenerationInput(
      request,
      projectContext,
      analysis,
      contextSummary,
    );
    onProgress?.(LoadingSteps.preparing);
    await this.yieldForUi();

    const promptSeed = this.buildPromptSeed(generationInput);
    onProgress?.(LoadingSteps.buildingPrompt);
    await this.yieldForUi();

    onProgress?.(LoadingSteps.sendingRequest);
    const generationPromise = this.llmRegistry.generate(request.providerId as ProviderId, {
      model: request.model,
      snippet: generationInput.snippet,
      languageId: request.languageId,
      filePath: request.filePath,
      project: generationInput.project,
    });

    onProgress?.(LoadingSteps.waitingForResponse);
    const rawResult = await generationPromise;

    const processed = this.processGenerationResult(
      rawResult.content,
      generationInput.metadata,
      promptSeed,
    );
    onProgress?.(LoadingSteps.processing);
    await this.yieldForUi();

    const finalContent = this.finalizeContent(processed, generationInput.metadata);
    onProgress?.(LoadingSteps.finalizing);
    await this.yieldForUi();

    const finalResult: WikiGenerationResult = {
      content: finalContent,
      success: true,
    };

    await this.generationCacheService.cacheGeneration(generateParams, finalResult);

    return finalResult;
  }

  private analyzeSnippet(snippet: string, languageId?: string): SnippetAnalysis {
    const normalized = snippet.replace(/\r\n/g, "\n");
    const lines = normalized.split("\n");
    const nonEmptyLines = lines.filter((line) => line.trim().length > 0);
    const tokens = this.extractSymbolCandidates(lines);

    return {
      languageId,
      lineCount: lines.length,
      nonEmptyLineCount: nonEmptyLines.length,
      characterCount: normalized.length,
      symbols: tokens,
    };
  }

  private extractSymbolCandidates(lines: string[]) {
    const candidates = new Set<string>();
    const identifierPattern = /(?:function|class|interface|type|const|let|var)\s+([A-Za-z0-9_]+)/;
    const callPattern = /([A-Za-z0-9_]+)\s*\(/;

    for (const line of lines) {
      const trimmed = line.trim();
      const declMatch = identifierPattern.exec(trimmed);
      if (declMatch?.[1]) {
        candidates.add(declMatch[1]);
        continue;
      }

      const callMatch = callPattern.exec(trimmed);
      if (callMatch?.[1]) {
        candidates.add(callMatch[1]);
      }
    }

    return Array.from(candidates).slice(0, 12);
  }

  private summarizeContext(projectContext: ProjectContext): ContextSummary {
    const related = projectContext.related ?? [];
    const filesSample = projectContext.filesSample ?? [];
    return {
      relatedCount: related.length,
      relatedPaths: related.map((entry) => entry.path).slice(0, 10),
      hasOverview: Boolean(projectContext.overview?.trim()),
      hasRootName: Boolean(projectContext.rootName?.trim()),
      filesSample: filesSample.slice(0, 20),
    };
  }

  private prepareGenerationInput(
    request: WikiGenerationRequest,
    projectContext: ProjectContext,
    analysis: SnippetAnalysis,
    contextSummary: ContextSummary,
  ): GenerationInput {
    const normalizedSnippet = request.snippet.trimEnd();

    const prunedProject: ProjectContext = {
      rootName: projectContext.rootName,
      overview: projectContext.overview,
      filesSample: projectContext.filesSample?.slice(0, 50),
      related: projectContext.related?.slice(0, 25),
    };

    return {
      snippet: normalizedSnippet,
      project: prunedProject,
      metadata: {
        analysis,
        context: contextSummary,
      },
    };
  }

  private buildPromptSeed(
    generationInput: GenerationInput,
  ) {
    const { analysis, context } = generationInput.metadata;
    const topSymbols = analysis.symbols.slice(0, 5).join(", ");
    const relatedPreview = context.relatedPaths.slice(0, 3).join(", ");

    const segments = [
      `Lines:${analysis.lineCount}`,
      `NonEmpty:${analysis.nonEmptyLineCount}`,
      topSymbols ? `Symbols:${topSymbols}` : null,
      relatedPreview ? `Related:${relatedPreview}` : null,
    ].filter(Boolean);

    return segments.join(" | ");
  }

  private processGenerationResult(
    content: string,
    metadata: GenerationMetadata,
    promptSeed: string,
  ): ProcessedGeneration {
    const normalized = content.replace(/\r\n/g, "\n").trim();
    const collapsed = normalized.replace(/\n{3,}/g, "\n\n");
    const headingMatches = collapsed.match(/^#\s+/gm) || [];
    const listMatches = collapsed.match(/^\s*[-*+]|\d+\.\s+/gm) || [];
    const paragraphMatches = collapsed.split(/\n\s*\n/).filter((block) => block.trim().length > 0);

    const metrics = {
      headingCount: headingMatches.length,
      listCount: listMatches.length,
      paragraphCount: paragraphMatches.length,
      promptSeedLength: promptSeed.length,
    };

    return {
      content: collapsed,
      metrics,
    };
  }

  private finalizeContent(
    processed: ProcessedGeneration,
    metadata: GenerationMetadata,
  ) {
    const lines = processed.content.split("\n");
    const hasHeading = /^#\s+/.test(lines[0] || "");
    const titleFromSymbol = metadata.analysis.symbols[0];
    const heading = hasHeading
      ? lines[0]
      : `# ${titleFromSymbol ? `${titleFromSymbol} Overview` : "Generated Wiki"}`;

    const body = hasHeading ? lines.slice(1).join("\n") : lines.join("\n");
    const ensuredSpacing = body.replace(/(#\s.+)/g, "\n$1").replace(/\n{3,}/g, "\n\n");
    const trimmed = ensuredSpacing.trimEnd();
    const rebuilt = `${heading}\n\n${trimmed}`.trimEnd();

    return rebuilt.endsWith("\n") ? rebuilt : `${rebuilt}\n`;
  }

  private async yieldForUi(minDuration = 12) {
    await new Promise((resolve) => setTimeout(resolve, minDuration));
  }
}
