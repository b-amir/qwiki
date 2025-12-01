import type { GenerateParams } from "@/llm/types";

/**
 * Google AI Studio (Gemini) Template
 *
 * Optimized for Gemini models which excel at:
 * - Structured output (uses responseMimeType: text/markdown)
 * - Following explicit format specifications
 * - Multi-step reasoning with clear instructions
 * - Long context understanding
 *
 * Best practices applied:
 * - Explicit section structure (Gemini follows format specs well)
 * - Clear delimiters between sections
 * - Numbered instructions for step-by-step execution
 * - Format examples upfront
 */
export const googlePromptTemplate = {
  system: `You are a technical documentation expert. Generate precise Markdown documentation.

STRICT OUTPUT FORMAT:
- Return ONLY valid Markdown
- Start with H1 title (max 36 chars): # Name - Purpose
- Use exactly these H2 sections in order:
  ## What It Is
  ## What It Does
  ## How It Works
  ## Usage Examples
  ## Important Considerations
  ## Related Components

RULES:
- Document only visible code behavior
- Use fenced code blocks with language tags
- Keep explanations concise (max 3 sentences per paragraph)
- No speculation about unimplemented features`,

  buildUserPrompt: (params: GenerateParams, context?: string, examples?: string[]): string => {
    const { snippet, languageId, filePath, semanticInfo, project } = params;

    const sections: string[] = [];

    sections.push(`TASK: Generate documentation for this ${languageId || "code"} snippet.`);

    sections.push(`CODE:
\`\`\`${languageId || ""}
${snippet}
\`\`\``);

    if (filePath) {
      sections.push(`FILE: ${filePath}`);
    }

    if (semanticInfo) {
      const info = [
        `Symbol: ${semanticInfo.symbolName} (${semanticInfo.symbolKind})`,
        semanticInfo.type ? `Type: ${semanticInfo.type}` : null,
        semanticInfo.returnType ? `Returns: ${semanticInfo.returnType}` : null,
        semanticInfo.parameters?.length
          ? `Parameters: ${semanticInfo.parameters.map((p) => p.name).join(", ")}`
          : null,
      ]
        .filter(Boolean)
        .join("\n");
      sections.push(`SEMANTIC INFO:\n${info}`);
    }

    if (context || project) {
      const ctx =
        context ||
        [
          project?.rootName ? `Project: ${project.rootName}` : null,
          project?.overview ? `Overview: ${project.overview}` : null,
        ]
          .filter(Boolean)
          .join("\n");
      if (ctx) sections.push(`CONTEXT:\n${ctx}`);
    }

    if (examples?.length) {
      sections.push(`REFERENCE EXAMPLES:\n${examples.join("\n---\n")}`);
    }

    sections.push(`OUTPUT: Generate Markdown documentation following the exact format specified.`);

    return sections.join("\n\n");
  },
};
