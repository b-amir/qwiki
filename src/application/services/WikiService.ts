import type { LLMRegistry } from "../../llm";
import type { WikiGenerationRequest, WikiGenerationResult } from "../../domain/entities/Wiki";
import type { ProjectContext } from "../../domain/entities/Selection";
import { LoadingSteps } from "../../constants/Events";
import type { LoadingStep } from "../../constants/Events";
import { ErrorCodes, ErrorMessages } from "../../constants";
import type { ProviderId } from "../../llm/types";
import { WikiError } from "../../errors";

export class WikiService {
  constructor(private llmRegistry: LLMRegistry) {}

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

      onProgress?.(LoadingSteps.analyzing);
      onProgress?.(LoadingSteps.finding);
      onProgress?.(LoadingSteps.preparing);
      onProgress?.(LoadingSteps.generating);

      const result = await this.llmRegistry.generate(request.providerId as ProviderId, {
        model: request.model,
        snippet: request.snippet,
        languageId: request.languageId,
        filePath: request.filePath,
        project: projectContext,
      });

      onProgress?.(LoadingSteps.processing);
      onProgress?.(LoadingSteps.finalizing);

      return {
        content: result.content,
        success: true,
      };
    } catch (error: any) {
      return {
        content: "",
        success: false,
        error: error?.message || ErrorMessages[ErrorCodes.generationFailed],
      };
    }
  }
}
