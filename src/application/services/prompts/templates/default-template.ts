import type { GenerateParams } from "@/llm/types";

/**
 * Default Template
 *
 * Fallback template for unknown providers or when specific optimization isn't needed.
 * Designed to be comprehensive and work with any LLM that follows instructions.
 *
 * This is the most detailed template with:
 * - Explicit formatting rules
 * - Complete section structure
 * - Comprehensive guidelines
 * - Example format included
 */
export const defaultPromptTemplate = {
  system: `You are a technical documentation specialist. Create accurate, comprehensive Markdown documentation for code.

STRICT REQUIREMENTS:
1. Return ONLY raw Markdown - no explanations or meta-commentary
2. Start with H1 title: # ComponentName - BriefPurpose (under 36 characters)
3. Use exactly these H2 sections in order:
   ## What It Is
   ## What It Does
   ## How It Works
   ## Usage Examples
   ## Important Considerations
   ## Related Components

CONTENT RULES:
- Document only visible code behavior
- Use fenced code blocks with language identifiers
- Keep paragraphs under 3 sentences
- Use bullet points for lists
- No speculation about unimplemented features

FORMATTING:
- Code blocks: \`\`\`language
- Links: [filename](openfile:path)
- No HTML tables`,

  buildUserPrompt: (params: GenerateParams, context?: string, examples?: string[]): string => {
    const { snippet, languageId, filePath, semanticInfo, project } = params;

    const parts: string[] = [];

    parts.push(`CODE TO DOCUMENT:
\`\`\`${languageId || ""}
${snippet}
\`\`\``);

    if (filePath) {
      parts.push(`File: ${filePath}`);
    }

    if (semanticInfo) {
      const info = [
        `- Symbol Name: ${semanticInfo.symbolName}`,
        `- Symbol Kind: ${semanticInfo.symbolKind}`,
        semanticInfo.type ? `- Type: ${semanticInfo.type}` : null,
        semanticInfo.isAsync ? `- Async: Yes (returns Promise)` : null,
        semanticInfo.returnType ? `- Return Type: ${semanticInfo.returnType}` : null,
        semanticInfo.parameters?.length
          ? `- Parameters:\n${semanticInfo.parameters.map((p) => `  - ${p.name}${p.type ? `: ${p.type}` : ""}`).join("\n")}`
          : null,
        semanticInfo.documentation ? `- Existing Docs: ${semanticInfo.documentation}` : null,
      ].filter(Boolean);
      parts.push(`Code Semantic Information:\n${info.join("\n")}`);
    }

    if (context || project) {
      const ctx = [
        project?.rootName ? `- Project: ${project.rootName}` : null,
        project?.overview ? `- Overview: ${project.overview}` : null,
        project?.filesSample?.length
          ? `- Files: ${project.filesSample.slice(0, 5).join(", ")}`
          : null,
        project?.related?.length
          ? `- Related:\n${project.related
              .slice(0, 5)
              .map((r) => `  - ${r.path}${r.reason ? ` (${r.reason})` : ""}`)
              .join("\n")}`
          : null,
        context ? `- Additional: ${context}` : null,
      ].filter(Boolean);
      if (ctx.length) parts.push(`Project Context:\n${ctx.join("\n")}`);
    }

    if (examples?.length) {
      parts.push(`Documentation Examples:\n${examples.join("\n---\n")}`);
    }

    parts.push(`Generate the documentation following the exact format specified above.`);

    return parts.join("\n\n");
  },
};
