import type { SavedWiki } from "@/application/services/storage/WikiStorageService";
import type { ReadmeUpdateService } from "@/application/services/readme/ReadmeUpdateService";
import type { ReadmeUpdateConfig } from "@/application/services/readme/workflow/ReadmeWorkflowOrchestrator";
import type { UpdateResult } from "@/domain/entities/ReadmeUpdate";
import { LoggingService, createLogger, type Logger } from "@/infrastructure/services";
import { ServiceLimits } from "@/constants/ServiceLimits";

interface ChunkedUpdateResult {
  success: boolean;
  passes: number;
  totalWikis: number;
  processedWikis: number;
  result: UpdateResult;
}

export class ReadmeChunkedUpdateService {
  private logger: Logger;

  constructor(
    private readmeUpdateService: ReadmeUpdateService,
    private loggingService: LoggingService,
  ) {
    this.logger = createLogger("ReadmeChunkedUpdateService");
  }

  async updateReadmeInChunks(
    wikiIds: string[],
    config: ReadmeUpdateConfig & { maxWikisPerUpdate?: number },
  ): Promise<ChunkedUpdateResult> {
    const maxWikisPerUpdate = config.maxWikisPerUpdate ?? ServiceLimits.readmeMaxWikisPerUpdate;

    if (wikiIds.length <= maxWikisPerUpdate) {
      this.logger.debug("Wiki count within limit, processing normally", {
        wikiCount: wikiIds.length,
        maxWikisPerUpdate,
      });

      const result = await this.readmeUpdateService.updateReadmeFromWikis(wikiIds, config);

      return {
        success: result.success,
        passes: 1,
        totalWikis: wikiIds.length,
        processedWikis: wikiIds.length,
        result,
      };
    }

    this.logger.info("Processing README update in chunks", {
      totalWikis: wikiIds.length,
      maxWikisPerUpdate,
      expectedPasses: Math.ceil(wikiIds.length / maxWikisPerUpdate),
    });

    const chunks = this.splitIntoChunks(wikiIds, maxWikisPerUpdate);
    let lastResult: UpdateResult | null = null;
    let processedCount = 0;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (!chunk) continue;
      const isFirstPass = i === 0;
      const isLastPass = i === chunks.length - 1;

      this.logger.debug(`Processing chunk ${i + 1}/${chunks.length}`, {
        chunkSize: chunk.length,
        wikisInChunk: chunk.length,
        isFirstPass,
        isLastPass,
      });

      const chunkConfig: ReadmeUpdateConfig = {
        ...config,
        backupOriginal: isFirstPass ? config.backupOriginal : false,
      };

      const chunkResult = await this.readmeUpdateService.updateReadmeFromWikis(chunk, chunkConfig);

      if (!chunkResult.success && !chunkResult.requiresApproval) {
        this.logger.error(`Chunk ${i + 1} failed`, {
          errors: chunkResult.conflicts,
        });

        return {
          success: false,
          passes: i + 1,
          totalWikis: wikiIds.length,
          processedWikis: processedCount,
          result: chunkResult,
        };
      }

      if (chunkResult.requiresApproval) {
        this.logger.info("Chunk requires approval, stopping chunked processing", {
          pass: i + 1,
          processedWikis: processedCount,
        });

        return {
          success: false,
          passes: i + 1,
          totalWikis: wikiIds.length,
          processedWikis: processedCount,
          result: chunkResult,
        };
      }

      lastResult = chunkResult;
      processedCount += chunk.length;
    }

    return {
      success: lastResult?.success ?? false,
      passes: chunks.length,
      totalWikis: wikiIds.length,
      processedWikis: processedCount,
      result: lastResult ?? {
        success: false,
        changes: [],
        conflicts: ["No chunks processed"],
      },
    };
  }

  private splitIntoChunks(wikiIds: string[], chunkSize: number): string[][] {
    const chunks: string[][] = [];

    for (let i = 0; i < wikiIds.length; i += chunkSize) {
      chunks.push(wikiIds.slice(i, i + chunkSize));
    }

    return chunks;
  }

  prioritizeWikis(wikis: SavedWiki[]): SavedWiki[] {
    return [...wikis].sort((a, b) => {
      const aLength = a.content.length;
      const bLength = b.content.length;

      const aHasCode = /\n```/.test(a.content);
      const bHasCode = /\n```/.test(b.content);

      const aHasExamples = /\b(example|usage|demo)\b/i.test(a.content);
      const bHasExamples = /\b(example|usage|demo)\b/i.test(b.content);

      let scoreA = 0;
      let scoreB = 0;

      if (aHasCode) scoreA += 10;
      if (bHasCode) scoreB += 10;

      if (aHasExamples) scoreA += 5;
      if (bHasExamples) scoreB += 5;

      scoreA += Math.min(aLength / 1000, 5);
      scoreB += Math.min(bLength / 1000, 5);

      return scoreB - scoreA;
    });
  }
}
