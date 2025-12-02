import { CancellationToken, Position } from "vscode";
import type { LLMRegistry } from "@/llm";
import type { ProviderId } from "@/llm/types";
import { createLogger, type Logger, type SemanticCodeInfo } from "@/infrastructure/services";
import { LoggingService } from "@/infrastructure/services";
import { ProviderError, ErrorCodes } from "@/errors";
import { LoadingSteps, type LoadingStep } from "@/constants/Events";
import type { WikiGenerationRequest } from "@/domain/entities/Wiki";
import type { GenerationInput } from "@/application/transformers/WikiTransformer";
import type { ProjectTypeDetection } from "@/domain/entities/ContextIntelligence";

export class LLMGenerationService {
  private logger: Logger;

  constructor(
    private llmRegistry: LLMRegistry,
    loggingService?: LoggingService,
  ) {
    this.logger = loggingService
      ? createLogger("LLMGenerationService")
      : ({ debug: () => {}, info: () => {}, warn: () => {}, error: () => {} } as Logger);
  }

  async callLLM(
    request: WikiGenerationRequest,
    generationInput: GenerationInput,
    semanticInfo: SemanticCodeInfo | null,
    onProgress?: (step: LoadingStep) => void,
    cancellationToken?: CancellationToken,
    onChunk?: (chunk: string, accumulatedContent: string) => void,
    projectType?: ProjectTypeDetection,
    examples?: string[],
  ): Promise<{ content: string }> {
    if (cancellationToken?.isCancellationRequested) {
      throw new ProviderError(ErrorCodes.GENERATION_CANCELLED, "Generation cancelled by user");
    }

    const provider = this.llmRegistry.getProvider(request.providerId as ProviderId);
    const supportsStreaming = provider?.generateStream && onChunk;

    if (supportsStreaming) {
      return this.callLLMStreaming(
        request,
        generationInput,
        semanticInfo,
        onProgress,
        cancellationToken,
        onChunk,
        projectType,
        examples,
      );
    }

    this.logger.info("Sending request to LLM", {
      providerId: request.providerId,
      model: request.model,
      hasSemanticInfo: !!semanticInfo,
    });
    const sendStepStart = Date.now();
    onProgress?.(LoadingSteps.sendingLLMRequest);

    if (cancellationToken?.isCancellationRequested) {
      throw new ProviderError(ErrorCodes.GENERATION_CANCELLED, "Generation cancelled by user");
    }

    const llmRequestStart = Date.now();
    const generationPromise = this.llmRegistry.generate(request.providerId as ProviderId, {
      model: request.model,
      snippet: generationInput.snippet,
      languageId: request.languageId,
      filePath: request.filePath,
      semanticInfo: semanticInfo ?? undefined,
      project: generationInput.project,
      projectType,
      examples,
    });
    const sendStepDuration = Date.now() - sendStepStart;
    this.logger.debug("Sending LLM request step completed", {
      step: LoadingSteps.sendingLLMRequest,
      duration: sendStepDuration,
    });

    this.logger.info("Waiting for LLM response");
    const waitStepStart = Date.now();
    onProgress?.(LoadingSteps.waitingForLLMResponse);
    try {
      const rawResult = await generationPromise;
      const waitStepDuration = Date.now() - waitStepStart;
      this.logger.debug("Waiting for LLM response step completed", {
        step: LoadingSteps.waitingForLLMResponse,
        duration: waitStepDuration,
      });

      if (cancellationToken?.isCancellationRequested) {
        throw new ProviderError(ErrorCodes.GENERATION_CANCELLED, "Generation cancelled by user");
      }
      const llmResponseDuration = Date.now() - llmRequestStart;
      this.logger.info("LLM response received successfully", {
        duration: llmResponseDuration,
        durationSeconds: Math.round(llmResponseDuration / 1000),
        responseLength: rawResult.content?.length || 0,
        providerId: request.providerId,
        model: request.model,
      });
      return rawResult;
    } catch (llmError: unknown) {
      const llmErrorDuration = Date.now() - llmRequestStart;
      const errObj = llmError as Record<string, unknown> | null;
      this.logger.error("LLM generation FAILED", {
        duration: llmErrorDuration,
        durationSeconds: Math.round(llmErrorDuration / 1000),
        error: errObj?.message,
        errorCode: errObj?.code,
        errorName: errObj?.name,
        stack: errObj?.stack,
        providerId: request.providerId,
        model: request.model,
      });
      throw llmError;
    }
  }

  private async callLLMStreaming(
    request: WikiGenerationRequest,
    generationInput: GenerationInput,
    semanticInfo: SemanticCodeInfo | null,
    onProgress?: (step: LoadingStep) => void,
    cancellationToken?: CancellationToken,
    onChunk?: (chunk: string, accumulatedContent: string) => void,
    projectType?: ProjectTypeDetection,
    examples?: string[],
  ): Promise<{ content: string }> {
    this.logger.info("Sending streaming request to LLM", {
      providerId: request.providerId,
      model: request.model,
      hasSemanticInfo: !!semanticInfo,
    });
    const sendStepStart = Date.now();
    onProgress?.(LoadingSteps.sendingLLMRequest);

    if (cancellationToken?.isCancellationRequested) {
      throw new ProviderError(ErrorCodes.GENERATION_CANCELLED, "Generation cancelled by user");
    }

    const llmRequestStart = Date.now();
    const sendStepDuration = Date.now() - sendStepStart;
    this.logger.debug("Sending LLM request step completed", {
      step: LoadingSteps.sendingLLMRequest,
      duration: sendStepDuration,
    });

    this.logger.info("Waiting for streaming LLM response");
    const waitStepStart = Date.now();
    onProgress?.(LoadingSteps.waitingForLLMResponse);

    let accumulatedContent = "";
    let chunkCount = 0;

    try {
      for await (const chunk of this.llmRegistry.generateStream(request.providerId as ProviderId, {
        model: request.model,
        snippet: generationInput.snippet,
        languageId: request.languageId,
        filePath: request.filePath,
        semanticInfo: semanticInfo ?? undefined,
        project: generationInput.project,
        projectType,
        examples,
      })) {
        if (cancellationToken?.isCancellationRequested) {
          throw new ProviderError(ErrorCodes.GENERATION_CANCELLED, "Generation cancelled by user");
        }

        chunkCount++;
        accumulatedContent += chunk;

        if (onChunk) {
          onChunk(chunk, accumulatedContent);
        }
      }

      const waitStepDuration = Date.now() - waitStepStart;
      this.logger.debug("Waiting for LLM response step completed", {
        step: LoadingSteps.waitingForLLMResponse,
        duration: waitStepDuration,
      });

      if (cancellationToken?.isCancellationRequested) {
        throw new ProviderError(ErrorCodes.GENERATION_CANCELLED, "Generation cancelled by user");
      }

      const llmResponseDuration = Date.now() - llmRequestStart;
      this.logger.info("LLM streaming response received successfully", {
        duration: llmResponseDuration,
        durationSeconds: Math.round(llmResponseDuration / 1000),
        responseLength: accumulatedContent.length,
        providerId: request.providerId,
        model: request.model,
      });

      return { content: accumulatedContent };
    } catch (llmError: unknown) {
      const llmErrorDuration = Date.now() - llmRequestStart;
      const errObj = llmError as Record<string, unknown> | null;
      this.logger.error("LLM streaming generation FAILED", {
        duration: llmErrorDuration,
        durationSeconds: Math.round(llmErrorDuration / 1000),
        error: errObj?.message,
        errorCode: errObj?.code,
        errorName: errObj?.name,
        stack: errObj?.stack,
        providerId: request.providerId,
        model: request.model,
      });
      throw llmError;
    }
  }
}
