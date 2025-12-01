import type { GenerateParams } from "@/llm/types";

/**
 * Z.ai Template
 *
 * Z.ai uses OpenAI-compatible chat format and already has a system message
 * in the provider code ("senior software engineer helping with code comprehension").
 *
 * This template focuses on:
 * - Complementing the existing system role
 * - Technical depth (leveraging the "senior engineer" persona)
 * - Architecture and design pattern focus
 * - Best practices emphasis
 *
 * Best practices applied:
 * - User message focuses on specific task
 * - Leverages the engineering context from system prompt
 * - Emphasizes code quality and patterns
 * - Clear output structure
 */
export const zaiPromptTemplate = {
  system: `Generate technical documentation in Markdown. Focus on architecture, design patterns, and best practices.

Required sections (use exact H2 headings):
## What It Is
## What It Does
## How It Works
## Usage Examples
## Important Considerations
## Related Components

Start with: # Name - Purpose (under 36 characters)

Be precise, technically accurate, and focus on what the code actually does.`,

  buildUserPrompt: (params: GenerateParams, context?: string, examples?: string[]): string => {
    const { snippet, languageId, filePath, semanticInfo, project } = params;

    const sections: string[] = [];

    sections.push(`Document this ${languageId || "code"} with focus on architecture and patterns:`);

    sections.push(`\`\`\`${languageId || ""}
${snippet}
\`\`\``);

    if (semanticInfo) {
      const analysis = [
        `- Symbol: ${semanticInfo.symbolName}`,
        `- Kind: ${semanticInfo.symbolKind}`,
        semanticInfo.type ? `- Type: ${semanticInfo.type}` : null,
        semanticInfo.returnType ? `- Returns: ${semanticInfo.returnType}` : null,
        semanticInfo.isAsync ? `- Async: Yes` : null,
        semanticInfo.parameters?.length
          ? `- Parameters: ${semanticInfo.parameters.map((p) => `${p.name}${p.type ? `: ${p.type}` : ""}`).join(", ")}`
          : null,
      ].filter(Boolean);
      sections.push(`Code Analysis:\n${analysis.join("\n")}`);
    }

    if (filePath) {
      sections.push(`Location: ${filePath}`);
    }

    if (context || project?.overview || project?.rootName) {
      const ctx = context || `${project?.rootName || ""} - ${project?.overview || ""}`.trim();
      sections.push(`Project: ${ctx}`);
    }

    if (project?.related?.length) {
      sections.push(
        `Related:\n${project.related
          .slice(0, 5)
          .map((r) => `- ${r.path}${r.reason ? `: ${r.reason}` : ""}`)
          .join("\n")}`,
      );
    }

    return sections.join("\n\n");
  },
};
