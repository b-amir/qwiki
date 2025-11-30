import { LoggingService, createLogger, type Logger } from "@/infrastructure/services";
import type {
  FileRelevanceScore,
  ProjectEssentialFile,
} from "@/domain/entities/ContextIntelligence";

export class FileSelectionService {
  private logger: Logger;

  constructor(private loggingService: LoggingService) {
    this.logger = createLogger("FileSelectionService");
  }

  selectFilesByTokenBudget(
    fileRelevanceScores: FileRelevanceScore[],
    availableTokens: number,
    utilizationTarget: number,
    essentialFiles: ProjectEssentialFile[] = [],
  ): {
    selectedFiles: FileRelevanceScore[];
    excludedFiles: FileRelevanceScore[];
    totalTokenCost: number;
  } {
    const selectStart = Date.now();

    const effectiveLimit = Math.floor(availableTokens * utilizationTarget);

    this.logger.info("Selecting files based on token budget", {
      availableTokens,
      utilizationTarget,
      effectiveLimit,
      essentialFileCount: essentialFiles.length,
      filesToConsider: fileRelevanceScores.length,
    });

    const selectedFiles: FileRelevanceScore[] = [];
    const excludedFiles: FileRelevanceScore[] = [];
    let totalTokenCost = 0;
    const selectedFilePaths = new Set<string>();

    for (const essential of essentialFiles) {
      if (totalTokenCost + essential.tokenCost <= effectiveLimit) {
        const essentialScore: FileRelevanceScore = {
          filePath: essential.filePath,
          score: 100,
          relevanceType: "essential",
          tokenCost: essential.tokenCost,
          compressionRatio: 0.5,
          metadata: {
            isDependency: false,
            isImportedBy: [],
            importsFrom: [],
            semanticSimilarity: 1.0,
            lastModified: new Date(),
            complexity: 0,
            fileCategory: essential.contentType === "package-manager" ? "config" : "source",
          },
        };
        selectedFiles.push(essentialScore);
        selectedFilePaths.add(essential.filePath);
        totalTokenCost += essential.tokenCost;
      } else {
        this.logger.warn("Essential file excluded due to token budget", {
          filePath: essential.filePath,
          tokenCost: essential.tokenCost,
          remainingBudget: effectiveLimit - totalTokenCost,
        });
      }
    }

    for (const fileScore of fileRelevanceScores) {
      if (selectedFilePaths.has(fileScore.filePath)) {
        continue;
      }

      if (totalTokenCost + fileScore.tokenCost <= effectiveLimit) {
        selectedFiles.push(fileScore);
        totalTokenCost += fileScore.tokenCost;
      } else {
        excludedFiles.push(fileScore);
      }
    }

    const selectDuration = Date.now() - selectStart;
    this.logger.info("File selection completed", {
      duration: selectDuration,
      selectedCount: selectedFiles.length,
      essentialCount: essentialFiles.length,
      excludedCount: excludedFiles.length,
      totalTokenCost,
      tokenUtilization: Math.round((totalTokenCost / availableTokens) * 100),
      effectiveUtilization: Math.round((totalTokenCost / effectiveLimit) * 100),
    });

    return { selectedFiles, excludedFiles, totalTokenCost };
  }
}
