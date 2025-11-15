import type { SavedWiki } from "@/application/services/storage/WikiStorageService";
import type { LLMRegistry } from "@/llm";
import type { ProviderId } from "@/llm/types";
import { LoggingService, createLogger, type Logger } from "@/infrastructure/services";
import { ServiceLimits } from "@/constants";

export interface OptimizedWikiSelection {
  included: SavedWiki[];
  excluded: SavedWiki[];
  summary?: string;
}

export interface TokenBudget {
  total: number;
  available: number;
  reserved: number;
  used: number;
}

export class ReadmePromptOptimizationService {
  private logger: Logger;
  private readonly tokensPerChar = 4;

  constructor(
    private llmRegistry: LLMRegistry,
    private loggingService: LoggingService,
  ) {
    this.logger = createLogger("ReadmePromptOptimizationService");
  }

  async optimizeWikiSelection(
    wikis: SavedWiki[],
    providerId: ProviderId,
    model?: string,
    currentReadmeLength: number = 0,
  ): Promise<OptimizedWikiSelection> {
    this.logger.debug(`Optimizing ${wikis.length} wikis for provider ${providerId}`);

    const provider = this.llmRegistry.getProvider(providerId);
    if (!provider) {
      this.logger.warn(`Provider ${providerId} not found, including all wikis`);
      return { included: wikis, excluded: [] };
    }

    let capabilities = provider.capabilities;
    if (provider.getModelCapabilities && model) {
      const modelCaps = provider.getModelCapabilities(model);
      if (modelCaps) {
        capabilities = modelCaps;
      }
    }

    const budget = this.calculateTokenBudget(capabilities.contextWindowSize, currentReadmeLength);
    const selection = this.selectWikisWithinBudget(wikis, budget);

    this.logger.info("Wiki selection completed", {
      total: wikis.length,
      included: selection.included.length,
      excluded: selection.excluded.length,
      tokensUsed: budget.used,
      tokensAvailable: budget.available,
    });

    return selection;
  }

  private calculateTokenBudget(
    contextWindowSize: number,
    currentReadmeLength: number,
  ): TokenBudget {
    const reservedTokens =
      ServiceLimits.readmeSystemPromptTokens +
      ServiceLimits.readmeInstructionsTokens +
      ServiceLimits.readmeOutputBufferTokens +
      Math.ceil(currentReadmeLength / this.tokensPerChar);

    const safetyMargin = Math.floor(contextWindowSize * ServiceLimits.readmeTokenSafetyMargin);
    const available = Math.max(0, contextWindowSize - reservedTokens - safetyMargin);

    return {
      total: contextWindowSize,
      reserved: reservedTokens,
      available,
      used: 0,
    };
  }

  private selectWikisWithinBudget(wikis: SavedWiki[], budget: TokenBudget): OptimizedWikiSelection {
    const included: SavedWiki[] = [];
    const excluded: SavedWiki[] = [];
    let tokensUsed = 0;

    const sortedWikis = [...wikis].sort((a, b) => {
      const aTime = a.createdAt.getTime();
      const bTime = b.createdAt.getTime();
      if (bTime !== aTime) {
        return bTime - aTime;
      }
      return b.content.length - a.content.length;
    });

    for (const wiki of sortedWikis) {
      const wikiTokens = this.estimateTokens(wiki.content);
      const truncatedTokens = this.estimateTruncatedTokens(wiki.content);

      if (tokensUsed + wikiTokens <= budget.available) {
        included.push(wiki);
        tokensUsed += wikiTokens;
      } else if (tokensUsed + truncatedTokens <= budget.available && truncatedTokens > 0) {
        const truncated = this.truncateWiki(wiki);
        included.push(truncated);
        tokensUsed += truncatedTokens;
      } else {
        excluded.push(wiki);
      }
    }

    budget.used = tokensUsed;

    return { included, excluded };
  }

  private truncateWiki(wiki: SavedWiki): SavedWiki {
    if (wiki.content.length <= ServiceLimits.readmeWikiTruncateLength) {
      return wiki;
    }

    const truncatedContent =
      wiki.content.substring(0, ServiceLimits.readmeWikiTruncateKeepLength) +
      "\n\n...\n\n" +
      this.extractSummary(wiki.content);

    return {
      ...wiki,
      content: truncatedContent,
    };
  }

  private extractSummary(content: string): string {
    const lines = content.split("\n");
    const firstParagraph = lines.slice(0, 3).join(" ").trim();
    if (firstParagraph.length > 200) {
      return firstParagraph.substring(0, 197) + "...";
    }
    return firstParagraph;
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / this.tokensPerChar);
  }

  private estimateTruncatedTokens(content: string): number {
    if (content.length <= ServiceLimits.readmeWikiTruncateLength) {
      return this.estimateTokens(content);
    }

    const truncatedLength =
      ServiceLimits.readmeWikiTruncateKeepLength + this.extractSummary(content).length + 10;
    return this.estimateTokens(content.substring(0, truncatedLength));
  }
}
