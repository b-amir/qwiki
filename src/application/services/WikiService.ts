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
          () => this.performLargeGeneration(request, projectContext, onProgress),
          TaskPriority.HIGH,
        ) as any;
      }

      return this.performGeneration(request, projectContext, onProgress);
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
    onProgress?: (step: LoadingStep) => void,
  ): Promise<WikiGenerationResult> {
    return this.requestBatchingService.batchRequest(
      async () => {
        onProgress?.(LoadingSteps.analyzing);
        await new Promise((resolve) => setTimeout(resolve, 50));

        onProgress?.(LoadingSteps.finding);
        await new Promise((resolve) => setTimeout(resolve, 50));

        onProgress?.(LoadingSteps.preparing);
        await new Promise((resolve) => setTimeout(resolve, 50));

        onProgress?.(LoadingSteps.buildingPrompt);
        await new Promise((resolve) => setTimeout(resolve, 50));

        onProgress?.(LoadingSteps.sendingRequest);
        await new Promise((resolve) => setTimeout(resolve, 50));

        onProgress?.(LoadingSteps.waitingForResponse);

        const result = await this.llmRegistry.generate(request.providerId as ProviderId, {
          model: request.model,
          snippet: request.snippet,
          languageId: request.languageId,
          filePath: request.filePath,
          project: projectContext,
        });

        const generateParams = {
          snippet: request.snippet,
          languageId: request.languageId,
          filePath: request.filePath,
          model: request.model,
          project: projectContext,
        };

        await this.generationCacheService.cacheGeneration(generateParams, result);

        onProgress?.(LoadingSteps.processing);
        onProgress?.(LoadingSteps.finalizing);

        return {
          content: result.content,
          success: true,
        };
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
    onProgress?: (step: LoadingStep) => void,
  ): Promise<WikiGenerationResult> {
    await this.memoryOptimizationService.optimizeMemory();

    onProgress?.(LoadingSteps.analyzing);
    await new Promise((resolve) => setTimeout(resolve, 100));

    onProgress?.(LoadingSteps.finding);
    await new Promise((resolve) => setTimeout(resolve, 100));

    onProgress?.(LoadingSteps.preparing);
    await new Promise((resolve) => setTimeout(resolve, 100));

    onProgress?.(LoadingSteps.buildingPrompt);
    await new Promise((resolve) => setTimeout(resolve, 100));

    onProgress?.(LoadingSteps.sendingRequest);
    await new Promise((resolve) => setTimeout(resolve, 100));

    onProgress?.(LoadingSteps.waitingForResponse);

    const result = await this.llmRegistry.generate(request.providerId as ProviderId, {
      model: request.model,
      snippet: request.snippet,
      languageId: request.languageId,
      filePath: request.filePath,
      project: projectContext,
    });

    const generateParams = {
      snippet: request.snippet,
      languageId: request.languageId,
      filePath: request.filePath,
      model: request.model,
      project: projectContext,
    };

    await this.generationCacheService.cacheGeneration(generateParams, result);

    onProgress?.(LoadingSteps.processing);
    onProgress?.(LoadingSteps.finalizing);

    await this.memoryOptimizationService.optimizeMemory();

    return {
      content: result.content,
      success: true,
    };
  }
}
