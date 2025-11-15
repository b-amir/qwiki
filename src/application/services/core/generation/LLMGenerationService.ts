import { CancellationToken, Position } from "vscode";
import type { LLMRegistry } from "@/llm";
import type { ProviderId } from "@/llm/types";
import { createLogger, type Logger } from "@/infrastructure/services";
import { LoggingService } from "@/infrastructure/services";
import { ProviderError, ErrorCodes } from "@/errors";
import { LoadingSteps, type LoadingStep } from "@/constants/Events";
import type { WikiGenerationRequest } from "@/domain/entities/Wiki";
import type { GenerationInput } from "@/application/transformers/WikiTransformer";

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
    semanticInfo: any,
    onProgress?: (step: LoadingStep) => void,
    cancellationToken?: CancellationToken,
  ): Promise<{ content: string }> {
    if (cancellationToken?.isCancellationRequested) {
      throw new ProviderError(ErrorCodes.GENERATION_CANCELLED, "Generation cancelled by user");
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
      semanticInfo,
      project: generationInput.project,
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
    } catch (llmError: any) {
      const llmErrorDuration = Date.now() - llmRequestStart;
      this.logger.error("LLM generation FAILED", {
        duration: llmErrorDuration,
        durationSeconds: Math.round(llmErrorDuration / 1000),
        error: llmError?.message,
        errorCode: llmError?.code,
        errorName: llmError?.name,
        stack: llmError?.stack,
        providerId: request.providerId,
        model: request.model,
      });
      throw llmError;
    }
  }
}
