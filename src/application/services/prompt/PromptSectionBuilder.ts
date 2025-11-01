import type { ProjectContext } from "../../../domain/entities/Selection";
import type { DynamicPromptConfig } from "../../../domain/entities/PromptEngineering";

export class PromptSectionBuilder {
  buildContextSection(context: ProjectContext): string {
    const parts: string[] = [];

    if (context.rootName) {
      parts.push(`Project Name: ${context.rootName}`);
    }

    if (context.overview) {
      parts.push(`Project Overview: ${context.overview}`);
    }

    if (context.filesSample && context.filesSample.length > 0) {
      parts.push(`Project Structure:\n${context.filesSample.map((p) => `  - ${p}`).join("\n")}`);
    }

    if (context.related && context.related.length > 0) {
      parts.push(
        `Related Files:\n${context.related
          .map(
            (r) =>
              `  - [${r.path}${r.line ? `:${r.line}` : ""}](openfile:${r.path}${r.line ? `:${r.line}` : ""})`,
          )
          .join("\n")}`,
      );
    }

    return parts.length > 0 ? parts.join("\n") : "";
  }

  buildInstructionsSection(config: DynamicPromptConfig): string {
    const complexity = config.complexity || 0.5;
    let instructions = "OUTPUT REQUIREMENTS:\n\nReturn ONLY raw Markdown content.\n\n";

    if (complexity > 0.7) {
      instructions +=
        "Include detailed implementation analysis and edge cases.\nFocus on architectural patterns and design decisions.\n";
    } else if (complexity < 0.3) {
      instructions +=
        "Keep documentation simple and straightforward.\nFocus on basic functionality.\n";
    }

    instructions +=
      "Sections: What It Is, What It Does, How It Works, Usage Examples, Important Considerations, Related Components.";

    return instructions;
  }

  buildOutputFormatSection(language: string): string {
    return `FORMATTING:
- Use fenced code blocks: \`\`\`${language}\`
- Keep paragraphs concise
- Use bullet points for lists
- Link files: [name](openfile:path)`;
  }

  buildExamplesSection(context: ProjectContext): string {
    if (!context.related || context.related.length === 0) {
      return "";
    }

    const examples = context.related.slice(0, 3).map((r) => `- ${r.path}`);
    return `Example related files:\n${examples.join("\n")}`;
  }
}
