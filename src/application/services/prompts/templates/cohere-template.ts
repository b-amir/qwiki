import type { GenerateParams } from "@/llm/types";

/**
 * Cohere (Command R/R+) Template
 *
 * Optimized for Command models which excel at:
 * - Single-task focus (one clear instruction)
 * - Precise language and direct commands
 * - Grounded responses (staying factual)
 * - Following structured formats
 *
 * Best practices applied:
 * - Preamble-style context (Cohere recommends upfront context)
 * - Single clear task directive
 * - Explicit output constraints
 * - No system message (Cohere API uses message field directly)
 */
export const coherePromptTemplate = {
  system: `Generate technical documentation in Markdown format.

Task: Create accurate code documentation with these exact sections:
# Title - Purpose (under 36 characters)
## What It Is
## What It Does
## How It Works
## Usage Examples
## Important Considerations
## Related Components

Constraints:
- Document only what is visible in the code
- Use code blocks with language identifiers
- Be concise and precise
- No speculation`,

  buildUserPrompt: (params: GenerateParams, context?: string, examples?: string[]): string => {
    const { snippet, languageId, filePath, semanticInfo, project } = params;

    const parts: string[] = [];

    if (project?.rootName || project?.overview || context) {
      parts.push(
        `Context: ${context || `${project?.rootName || "Project"} - ${project?.overview || ""}`.trim()}`,
      );
    }

    if (filePath) {
      parts.push(`File: ${filePath}`);
    }

    if (semanticInfo) {
      parts.push(
        `Code info: ${semanticInfo.symbolName} (${semanticInfo.symbolKind})${semanticInfo.returnType ? ` returns ${semanticInfo.returnType}` : ""}`,
      );
    }

    parts.push(`Code to document:
\`\`\`${languageId || ""}
${snippet}
\`\`\``);

    parts.push(`Generate the documentation now.`);

    return parts.join("\n\n");
  },
};
