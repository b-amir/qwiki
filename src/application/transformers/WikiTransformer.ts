import type { ProjectContext } from "@/domain/entities/Selection";
import type { WikiGenerationRequest } from "@/domain/entities/Wiki";
import { ServiceLimits } from "@/constants";

export interface SnippetAnalysis {
  languageId?: string;
  lineCount: number;
  nonEmptyLineCount: number;
  characterCount: number;
  symbols: string[];
}

export interface ContextSummary {
  relatedCount: number;
  relatedPaths: string[];
  hasOverview: boolean;
  hasRootName: boolean;
  filesSample: string[];
}

export interface GenerationMetadata {
  analysis: SnippetAnalysis;
  context: ContextSummary;
}

export interface GenerationInput {
  snippet: string;
  project: ProjectContext;
  metadata: GenerationMetadata;
}

export interface ProcessedGeneration {
  content: string;
  metrics: {
    headingCount: number;
    listCount: number;
    paragraphCount: number;
    promptSeedLength: number;
  };
}

export class WikiTransformer {
  static analyzeSnippet(snippet: string, languageId?: string): SnippetAnalysis {
    const normalized = snippet.replace(/\r\n/g, "\n");
    const lines = normalized.split("\n");
    let nonEmptyLineCount = 0;
    for (const line of lines) {
      if (line.trim().length > 0) {
        nonEmptyLineCount++;
      }
    }
    const tokens = WikiTransformer.extractSymbolCandidates(lines);

    return {
      languageId,
      lineCount: lines.length,
      nonEmptyLineCount,
      characterCount: normalized.length,
      symbols: tokens,
    };
  }

  static extractSymbolCandidates(lines: string[]): string[] {
    const candidates = new Set<string>();
    const combinedPattern =
      /(?:(?:function|class|interface|type|const|let|var)\s+([A-Za-z0-9_]+)|([A-Za-z0-9_]+)\s*\()/;

    for (const line of lines) {
      const trimmed = line.trim();
      const match = combinedPattern.exec(trimmed);
      if (match) {
        const identifier = match[1] || match[2];
        if (identifier) {
          candidates.add(identifier);
          if (candidates.size >= ServiceLimits.symbolsPerSnippet) break;
        }
      }
    }

    return Array.from(candidates);
  }

  static summarizeContext(projectContext: ProjectContext): ContextSummary {
    const related = projectContext.related ?? [];
    const filesSample = projectContext.filesSample ?? [];
    return {
      relatedCount: related.length,
      relatedPaths: related
        .map((entry) => entry.path)
        .slice(0, ServiceLimits.maxRelatedPathsPreview),
      hasOverview: Boolean(projectContext.overview?.trim()),
      hasRootName: Boolean(projectContext.rootName?.trim()),
      filesSample: filesSample.slice(0, ServiceLimits.maxFilesSamplePreview),
    };
  }

  static prepareGenerationInput(
    request: WikiGenerationRequest,
    projectContext: ProjectContext,
    analysis: SnippetAnalysis,
    contextSummary: ContextSummary,
  ): GenerationInput {
    const normalizedSnippet = request.snippet.trimEnd();

    const prunedProject: ProjectContext = {
      rootName: projectContext.rootName,
      overview: projectContext.overview,
      filesSample: projectContext.filesSample?.slice(0, ServiceLimits.maxFileSampleDefault),
      related: projectContext.related?.slice(0, ServiceLimits.maxRelatedPaths),
    };

    return {
      snippet: normalizedSnippet,
      project: prunedProject,
      metadata: {
        analysis,
        context: contextSummary,
      },
    };
  }

  static buildPromptSeed(generationInput: GenerationInput): string {
    const { analysis, context } = generationInput.metadata;
    const topSymbols = analysis.symbols.slice(0, ServiceLimits.maxTopSymbols).join(", ");
    const relatedPreview = context.relatedPaths
      .slice(0, ServiceLimits.maxRelatedPreview)
      .join(", ");

    const segments = [
      `Lines:${analysis.lineCount}`,
      `NonEmpty:${analysis.nonEmptyLineCount}`,
      topSymbols ? `Symbols:${topSymbols}` : null,
      relatedPreview ? `Related:${relatedPreview}` : null,
    ].filter(Boolean);

    return segments.join(" | ");
  }

  static processGenerationResult(
    content: string,
    metadata: GenerationMetadata,
    promptSeed: string,
  ): ProcessedGeneration {
    const normalized = content.replace(/\r\n/g, "\n").trim();
    const collapsed = normalized.replace(/\n{3,}/g, "\n\n");

    let headingCount = 0;
    let listCount = 0;
    const paragraphSet = new Set<number>();

    const lines = collapsed.split("\n");
    let currentParagraphStart = 0;
    let inParagraph = false;

    const headingPattern = /^#\s+/;
    const listPattern = /^\s*[-*+]|\d+\.\s+/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const trimmed = line.trim();

      if (headingPattern.test(line)) {
        headingCount++;
      }

      if (listPattern.test(line)) {
        listCount++;
      }

      if (trimmed.length > 0) {
        if (!inParagraph) {
          currentParagraphStart = i;
          inParagraph = true;
        }
      } else {
        if (inParagraph) {
          paragraphSet.add(currentParagraphStart);
          inParagraph = false;
        }
      }
    }

    if (inParagraph) {
      paragraphSet.add(currentParagraphStart);
    }

    const metrics = {
      headingCount,
      listCount,
      paragraphCount: paragraphSet.size,
      promptSeedLength: promptSeed.length,
    };

    return {
      content: collapsed,
      metrics,
    };
  }

  static finalizeContent(processed: ProcessedGeneration, metadata: GenerationMetadata): string {
    const lines = processed.content.split("\n");
    const firstLine = lines[0];
    const hasHeading = firstLine ? /^#\s+/.test(firstLine) : false;
    const titleFromSymbol = metadata.analysis.symbols[0];
    const heading = hasHeading && firstLine
      ? firstLine
      : `# ${titleFromSymbol ? `${titleFromSymbol} Overview` : "Generated Wiki"}`;

    const body = hasHeading ? lines.slice(1).join("\n") : lines.join("\n");
    const ensuredSpacing = body
      .replace(/^\s*#\s*$/gm, "")
      .replace(/(\S)\n(#\s+.+)/g, "$1\n\n$2")
      .replace(/\n{3,}/g, "\n\n");
    const trimmed = ensuredSpacing.trimEnd();
    const rebuilt = `${heading}\n\n${trimmed}`.trimEnd();

    return rebuilt.endsWith("\n") ? rebuilt : `${rebuilt}\n`;
  }
}
