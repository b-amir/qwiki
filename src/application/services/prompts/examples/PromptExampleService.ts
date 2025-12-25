import { LoggingService, createLogger, type Logger } from "@/infrastructure/services";
import { CachingService } from "@/infrastructure/services/caching/CachingService";
import { SavedWiki } from "../../storage/WikiStorageService";

export class PromptExampleService {
  private logger: Logger;
  private readonly EXAMPLES_CACHE_KEY = "prompt:examples";

  constructor(
    private cachingService: CachingService,
    private loggingService: LoggingService,
  ) {
    this.logger = createLogger("PromptExampleService");
  }

  async getRelevantExamples(
    snippet: string,
    language: string,
    count: number = 2,
  ): Promise<string[]> {
    try {
      const savedWikis = await this.getSavedWikisAsExamples();
      if (savedWikis.length === 0) {
        return [];
      }

      const examples = this.findSimilarExamples(snippet, language, savedWikis, count);

      return examples.map((ex) => this.formatExample(ex));
    } catch (error) {
      this.logger.debug("Failed to get relevant examples", error);
      return [];
    }
  }

  private async getSavedWikisAsExamples(): Promise<SavedWiki[]> {
    try {
      const cached = await this.cachingService.get<SavedWiki[]>(this.EXAMPLES_CACHE_KEY);
      if (cached && cached.length > 0) {
        return cached;
      }
      return [];
    } catch {
      return [];
    }
  }

  async updateExamplesCache(wikis: SavedWiki[]): Promise<void> {
    try {
      const examples = wikis
        .filter((wiki) => wiki.content && wiki.content.length > 100)
        .slice(0, 50);
      await this.cachingService.set(this.EXAMPLES_CACHE_KEY, examples, { ttl: 3600000 });
      this.logger.debug("Examples cache updated", { count: examples.length });
    } catch (error) {
      this.logger.debug("Failed to update examples cache", error);
    }
  }

  private findSimilarExamples(
    snippet: string,
    language: string,
    savedWikis: SavedWiki[],
    count: number,
  ): SavedWiki[] {
    const snippetLower = snippet.toLowerCase();
    const snippetWords = new Set(snippetLower.match(/\b\w{3,}\b/g) || []);

    const scored = savedWikis
      .filter((wiki) => {
        const wikiLanguage = this.detectLanguageFromContent(wiki.content);
        return !language || wikiLanguage === language || wikiLanguage === "unknown";
      })
      .map((wiki) => {
        const similarity = this.calculateSimilarity(snippetWords, wiki);
        return { wiki, similarity };
      })
      .filter((item) => item.similarity > 0.1)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, count)
      .map((item) => item.wiki);

    return scored;
  }

  private calculateSimilarity(snippetWords: Set<string>, wiki: SavedWiki): number {
    const wikiText = `${wiki.title} ${wiki.content}`.toLowerCase();
    const wikiWords = new Set(wikiText.match(/\b\w{3,}\b/g) || []);

    let matches = 0;
    for (const word of snippetWords) {
      if (wikiWords.has(word)) {
        matches++;
      }
    }

    const union = new Set([...snippetWords, ...wikiWords]);
    return union.size > 0 ? matches / union.size : 0;
  }

  private detectLanguageFromContent(content: string): string {
    if (
      content.includes("```typescript") ||
      content.includes("interface") ||
      content.includes("type ")
    ) {
      return "typescript";
    }
    if (
      content.includes("```javascript") ||
      content.includes("function ") ||
      content.includes("const ")
    ) {
      return "javascript";
    }
    if (content.includes("```python") || content.includes("def ") || content.includes("import ")) {
      return "python";
    }
    return "unknown";
  }

  private formatExample(wiki: SavedWiki): string {
    const codeMatch = wiki.content.match(/```[\w]*\n([\s\S]*?)```/);
    const code = codeMatch ? (codeMatch[1] ?? "").trim() : "";
    const documentation = wiki.content.replace(/```[\w]*\n[\s\S]*?```/g, "").trim();

    if (!code || !documentation) {
      return `Code:\n\`\`\`\n${code || ""}\n\`\`\`\n\nDocumentation:\n${wiki.content}`;
    }

    return `Code:\n\`\`\`\n${code}\n\`\`\`\n\nDocumentation:\n${documentation}`;
  }
}
