import type { EventBus } from "@/events/EventBus";
import { OutboundEvents, LoadingSteps } from "@/constants/Events";
import type { LoadingStep } from "@/constants/Events";
import { getProgressMessageForStep } from "@/constants/loading";

export interface LoadingStepProgressPayload {
  step: LoadingStep;
  percentage?: number;
  message?: string;
  elapsed?: number;
  estimatedRemaining?: number;
  sequence?: number;
  timestamp?: number;
}

export class ProgressManager {
  private readonly stepOrder: LoadingStep[] = [
    LoadingSteps.validatingProvider,
    LoadingSteps.initializingContext,
    LoadingSteps.analyzingSnippet,
    LoadingSteps.buildingContextSummary,
    LoadingSteps.preparingGenerationInput,
    LoadingSteps.buildingPrompt,
    LoadingSteps.validatingPromptQuality,
    LoadingSteps.collectingSemanticInfo,
    LoadingSteps.sendingLLMRequest,
    LoadingSteps.waitingForLLMResponse,
    LoadingSteps.processingLLMOutput,
    LoadingSteps.finalizingDocumentation,
  ];

  private readonly defaultStepDurations: Map<LoadingStep, number> = new Map([
    [LoadingSteps.validatingProvider, 500],
    [LoadingSteps.initializingContext, 3000],
    [LoadingSteps.analyzingSnippet, 500],
    [LoadingSteps.buildingContextSummary, 1000],
    [LoadingSteps.preparingGenerationInput, 500],
    [LoadingSteps.buildingPrompt, 1000],
    [LoadingSteps.validatingPromptQuality, 2000],
    [LoadingSteps.collectingSemanticInfo, 1500],
    [LoadingSteps.sendingLLMRequest, 500],
    [LoadingSteps.waitingForLLMResponse, 30000],
    [LoadingSteps.processingLLMOutput, 1000],
    [LoadingSteps.finalizingDocumentation, 500],
  ]);

  constructor(
    private eventBus: EventBus,
    private updateStatusBar: (message: string) => void
  ) {}

  public calculateProgress(step: LoadingStep, startTime: number): LoadingStepProgressPayload {
    const currentIndex = this.stepOrder.indexOf(step);
    const percentage =
      currentIndex >= 0 ? Math.round(((currentIndex + 1) / this.stepOrder.length) * 100) : 0;
    const elapsed = Date.now() - startTime;

    let estimatedTotal = 0;
    if (currentIndex >= 0) {
      for (let i = 0; i <= currentIndex; i++) {
        const step = this.stepOrder[i];
        if (step) {
          const stepDuration = this.defaultStepDurations.get(step) || 1000;
          estimatedTotal += stepDuration;
        }
      }
    }
    const estimatedRemaining = estimatedTotal > elapsed ? estimatedTotal - elapsed : undefined;

    const message = getProgressMessageForStep(step);

    return {
      step,
      percentage,
      message,
      elapsed,
      estimatedRemaining,
    };
  }

  public reportProgress(payload: LoadingStepProgressPayload): void {
    if (payload.message) {
      this.updateStatusBar(payload.message);
    }
    this.eventBus.publish(OutboundEvents.loadingStep, payload);
  }
}
