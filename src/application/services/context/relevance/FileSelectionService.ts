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
  ): {
    selectedFiles: FileRelevanceScore[];
    excludedFiles: FileRelevanceScore[];
    totalTokenCost: number;
  } {
    const selectStart = Date.now();
    this.logger.info("Selecting files based on token budget", {
      availableTokens,
      utilizationTarget,
      filesToConsider: fileRelevanceScores.length,
    });

    const selectedFiles: FileRelevanceScore[] = [];
    const excludedFiles: FileRelevanceScore[] = [];
    let totalTokenCost = 0;

    for (const fileScore of fileRelevanceScores) {
      if (totalTokenCost + fileScore.tokenCost <= availableTokens) {
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
      excludedCount: excludedFiles.length,
      totalTokenCost,
      tokenUtilization: Math.round((totalTokenCost / availableTokens) * 100),
    });

    return { selectedFiles, excludedFiles, totalTokenCost };
  }

  addEssentialFiles(
    essentialFiles: ProjectEssentialFile[],
    selectedFiles: FileRelevanceScore[],
    totalTokenCost: number,
    availableTokens: number,
  ): { selectedFiles: FileRelevanceScore[]; totalTokenCost: number } {
    const essentialStart = Date.now();
    this.logger.debug("Adding essential files", { essentialCount: essentialFiles.length });
    const selectedFilePaths = new Set(selectedFiles.map((f) => f.filePath));
    let updatedTokenCost = totalTokenCost;

    for (const essential of essentialFiles) {
      const alreadyIncluded = selectedFilePaths.has(essential.filePath);
      if (!alreadyIncluded && updatedTokenCost + essential.tokenCost <= availableTokens) {
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
        updatedTokenCost += essential.tokenCost;
      }
    }

    this.logger.debug("Essential files processed", {
      duration: Date.now() - essentialStart,
      finalSelectedCount: selectedFiles.length,
      finalTokenCost: updatedTokenCost,
    });

    return { selectedFiles, totalTokenCost: updatedTokenCost };
  }
}
