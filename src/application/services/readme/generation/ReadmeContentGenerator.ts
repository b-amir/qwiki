import { createLogger, type Logger } from "@/infrastructure/services";
import { LoggingService } from "@/infrastructure/services";
import type { LLMRegistry } from "@/llm";
import type { ProviderId } from "@/llm/types";
import { ServiceLimits } from "@/constants/ServiceLimits";
import { LoadingSteps } from "@/constants/loading";
import { ReadmePromptBuilderService } from "@/application/services/readme/ReadmePromptBuilderService";
import { ReadmePromptOptimizationService } from "@/application/services/readme/ReadmePromptOptimizationService";
import { ReadmeCacheService } from "@/application/services/readme/ReadmeCacheService";
import {
  ReadmeStateDetectionService,
  ReadmeState,
} from "@/application/services/readme/ReadmeStateDetectionService";
import { ReadmeContentAnalysisService } from "@/application/services/readme/ReadmeContentAnalysisService";
import type { Wiki } from "@/domain/entities/Wiki";
import type { SavedWiki } from "@/application/services/storage/WikiStorageService";

export interface GenerationContext {
  currentReadme: string;
  readmeState: ReadmeState;
  isBoilerplate: boolean;
  wikis: SavedWiki[];
  sortedWikiIds: string[];
}

export class ReadmeContentGenerator {
  private logger: Logger;

  constructor(
    private llmRegistry: LLMRegistry,
    private promptBuilderService: ReadmePromptBuilderService,
    private promptOptimizationService: ReadmePromptOptimizationService,
    private cacheService: ReadmeCacheService,
    private stateDetectionService: ReadmeStateDetectionService,
    private contentAnalysisService: ReadmeContentAnalysisService,
    loggingService: LoggingService,
  ) {
    this.logger = createLogger("ReadmeContentGenerator");
  }

  async generateContent(
    context: GenerationContext,
    providerId: ProviderId,
    model: string | undefined,
    timeout: number,
    onProgress?: (step: string, percent?: number) => void,
  ): Promise<string> {
    onProgress?.(LoadingSteps.optimizingWikiSelection, 40);

    const optimized = await this.promptOptimizationService.optimizeWikiSelection(
      context.wikis,
      providerId,
      model,
      context.currentReadme.length,
    );

    onProgress?.(LoadingSteps.buildingReadmePrompt, 50);

    const cachedContent = await this.cacheService.getCachedReadme(
      context.sortedWikiIds,
      context.currentReadme,
    );

    if (cachedContent) {
      this.logger.info("Using cached README generation result", {
        wikiCount: context.sortedWikiIds.length,
      });
      return cachedContent;
    }

    const prompt = await this.promptBuilderService.buildPrompt(
      context.currentReadme,
      optimized.included,
      optimized.excluded,
      context.isBoilerplate,
      context.readmeState,
    );

    onProgress?.(LoadingSteps.generatingReadmeContent, 60);

    const generatedContent = await this.generateWithLLM(prompt, providerId, model, timeout);

    await this.cacheService.cacheReadme(
      context.sortedWikiIds,
      context.currentReadme,
      generatedContent,
    );

    return generatedContent;
  }

  private async generateWithLLM(
    prompt: string,
    providerId: ProviderId,
    model: string | undefined,
    timeout: number,
  ): Promise<string> {
    const generatePromise = this.llmRegistry.generate(providerId, {
      model,
      snippet: prompt,
      languageId: "markdown",
      filePath: "README.md",
      timeoutMs: timeout,
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Request timeout")), timeout),
    );

    const result = await Promise.race([generatePromise, timeoutPromise]);
    return result.content;
  }
}
