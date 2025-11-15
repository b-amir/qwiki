import type { SavedWiki } from "@/application/services/storage/WikiStorageService";
import type { ReadmeSection } from "@/domain/entities/ReadmeUpdate";

export class ReadmeSectionGenerator {
  async generateProjectOverview(wikis: SavedWiki[]): Promise<string> {
    if (wikis.length === 0) return "";

    const overview = wikis
      .map((wiki) => {
        const firstParagraph = wiki.content.split("\n\n")[0];
        return firstParagraph.substring(0, 300);
      })
      .join("\n\n");

    return overview || "";
  }

  async generateInstallationGuide(wikis: SavedWiki[]): Promise<string> {
    const installationWikis = wikis.filter(
      (w) => /install|setup|getting.?started/i.test(w.title) || /install|setup/i.test(w.content),
    );

    if (installationWikis.length === 0) return "";

    const content = installationWikis.map((wiki) => wiki.content).join("\n\n");
    return content.substring(0, 1000);
  }

  async generateUsageSection(wikis: SavedWiki[]): Promise<string> {
    const usageWikis = wikis.filter(
      (w) => /usage|example|how.?to|tutorial/i.test(w.title) || /usage|example/i.test(w.content),
    );

    if (usageWikis.length === 0) {
      const codeExamples = wikis
        .filter((w) => /```/.test(w.content))
        .map((w) => w.content.match(/```[\s\S]*?```/)?.[0])
        .filter(Boolean)
        .slice(0, 3);

      if (codeExamples.length > 0) {
        return codeExamples.join("\n\n");
      }
      return "";
    }

    return usageWikis
      .map((wiki) => wiki.content)
      .join("\n\n")
      .substring(0, 1000);
  }

  async generateApiDocumentation(wikis: SavedWiki[]): Promise<string> {
    const apiWikis = wikis.filter(
      (w) =>
        /api|endpoint|function|method|class|interface/i.test(w.title) ||
        /api|endpoint|function/i.test(w.content),
    );

    if (apiWikis.length === 0) return "";

    return apiWikis
      .map((wiki) => {
        const title = wiki.title;
        const content = wiki.content.substring(0, 500);
        return `### ${title}\n\n${content}`;
      })
      .join("\n\n");
  }
}
