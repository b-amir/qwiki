import type { LLMRegistry } from "../../llm";
import type { WikiGenerationRequest, WikiGenerationResult } from "../../domain/entities/Wiki";
import type { ProjectContext } from "../../domain/entities/Selection";
import { LoadingSteps } from "../../constants/Events";
import type { LoadingStep } from "../../constants/Events";
import { ErrorCodes, ErrorMessages, ServiceLimits } from "../../constants";
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
      ServiceLimits.debounceDelay,
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

      if (request.snippet.length > ServiceLimits.largeSnippetThreshold) {
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
        maxBatchSize: ServiceLimits.batchMaxSize,
        maxWaitTime: ServiceLimits.batchMaxWaitTime,
        deduplicationKey: `${this.generationCacheKeyPrefix}_${request.snippet.substring(0, ServiceLimits.deduplicationKeyPrefixLength)}`,
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
    let nonEmptyLineCount = 0;
    for (const line of lines) {
      if (line.trim().length > 0) {
        nonEmptyLineCount++;
      }
    }
    const tokens = this.extractSymbolCandidates(lines);

    return {
      languageId,
      lineCount: lines.length,
      nonEmptyLineCount,
      characterCount: normalized.length,
      symbols: tokens,
    };
  }

  private extractSymbolCandidates(lines: string[]) {
    const candidates = new Set<string>();
    const combinedPattern =
      /(?:(?:function|class|interface|type|const|let|var)\s+([A-Za-z0-9_]+)|([A-Za-z0-9_]+)\s*\()/;

    for (const line of lines) {
      const trimmed = line.trim();
      const match = combinedPattern.exec(trimmed);
      if (match) {
        const identifier = match[1] || match[2];
        if (identifier) {
          candidates.add(identifier);
          if (candidates.size >= ServiceLimits.symbolsPerSnippet) break;
        }
      }
    }

    return Array.from(candidates);
  }

  private summarizeContext(projectContext: ProjectContext): ContextSummary {
    const related = projectContext.related ?? [];
    const filesSample = projectContext.filesSample ?? [];
    return {
      relatedCount: related.length,
      relatedPaths: related
        .map((entry) => entry.path)
        .slice(0, ServiceLimits.maxRelatedPathsPreview),
      hasOverview: Boolean(projectContext.overview?.trim()),
      hasRootName: Boolean(projectContext.rootName?.trim()),
      filesSample: filesSample.slice(0, ServiceLimits.maxFilesSamplePreview),
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
      filesSample: projectContext.filesSample?.slice(0, ServiceLimits.maxFileSampleDefault),
      related: projectContext.related?.slice(0, ServiceLimits.maxRelatedPaths),
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

  private buildPromptSeed(generationInput: GenerationInput) {
    const { analysis, context } = generationInput.metadata;
    const topSymbols = analysis.symbols.slice(0, ServiceLimits.maxTopSymbols).join(", ");
    const relatedPreview = context.relatedPaths
      .slice(0, ServiceLimits.maxRelatedPreview)
      .join(", ");

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

    let headingCount = 0;
    let listCount = 0;
    const paragraphSet = new Set<number>();

    const lines = collapsed.split("\n");
    let currentParagraphStart = 0;
    let inParagraph = false;

    const headingPattern = /^#\s+/;
    const listPattern = /^\s*[-*+]|\d+\.\s+/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (headingPattern.test(line)) {
        headingCount++;
      }

      if (listPattern.test(line)) {
        listCount++;
      }

      if (trimmed.length > 0) {
        if (!inParagraph) {
          currentParagraphStart = i;
          inParagraph = true;
        }
      } else {
        if (inParagraph) {
          paragraphSet.add(currentParagraphStart);
          inParagraph = false;
        }
      }
    }

    if (inParagraph) {
      paragraphSet.add(currentParagraphStart);
    }

    const metrics = {
      headingCount,
      listCount,
      paragraphCount: paragraphSet.size,
      promptSeedLength: promptSeed.length,
    };

    return {
      content: collapsed,
      metrics,
    };
  }

  private finalizeContent(processed: ProcessedGeneration, metadata: GenerationMetadata) {
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

  private async yieldForUi(minDuration = ServiceLimits.uiYieldDuration) {
    await new Promise((resolve) => setTimeout(resolve, minDuration));
  }
}
