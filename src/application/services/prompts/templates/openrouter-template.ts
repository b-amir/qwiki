import type { GenerateParams } from "@/llm/types";

/**
 * OpenRouter Template
 *
 * OpenRouter routes to multiple models (GPT, Llama, WizardLM, etc.)
 * This template is designed to work well across different model types:
 * - Uses OpenAI chat format (system + user messages)
 * - Balanced detail level (not too verbose, not too sparse)
 * - Clear structure that most models can follow
 * - Explicit examples for consistency
 *
 * Best practices applied:
 * - Role-based prompting (works with chat-tuned models)
 * - Explicit output format specification
 * - Context integration when available
 * - Flexible enough for various model capabilities
 */
export const openrouterPromptTemplate = {
  system: `You are a code documentation expert. Generate Markdown documentation following this exact structure:

# ComponentName - BriefPurpose
(Title must be under 36 characters)

## What It Is
Brief technical definition.

## What It Does
Observable behavior and functionality.

## How It Works
Implementation details from the code.

## Usage Examples
Real code examples.

## Important Considerations
Edge cases, limitations, requirements.

## Related Components
References to related files/components.

Rules:
- Document only what's in the code
- Use \`\`\`language code blocks
- Be concise (max 3 sentences per paragraph)
- No speculation about unimplemented features`,

  buildUserPrompt: (params: GenerateParams, context?: string, examples?: string[]): string => {
    const { snippet, languageId, filePath, semanticInfo, project } = params;

    const parts: string[] = [];

    parts.push(`Generate documentation for this code:`);

    parts.push(`\`\`\`${languageId || "javascript"}
${snippet}
\`\`\``);

    if (filePath) {
      parts.push(`File: ${filePath}`);
    }

    if (semanticInfo) {
      const info: string[] = [`Symbol: ${semanticInfo.symbolName} (${semanticInfo.symbolKind})`];
      if (semanticInfo.type) info.push(`Type: ${semanticInfo.type}`);
      if (semanticInfo.returnType) info.push(`Returns: ${semanticInfo.returnType}`);
      if (semanticInfo.parameters?.length) {
        info.push(
          `Params: ${semanticInfo.parameters.map((p) => `${p.name}${p.type ? `: ${p.type}` : ""}`).join(", ")}`,
        );
      }
      parts.push(`Code Analysis:\n${info.join("\n")}`);
    }

    if (context || project?.overview) {
      parts.push(`Project Context: ${context || project?.overview || ""}`);
    }

    if (project?.related?.length) {
      parts.push(
        `Related Files: ${project.related
          .slice(0, 5)
          .map((r) => r.path)
          .join(", ")}`,
      );
    }

    if (examples?.length) {
      parts.push(`Example documentation format:\n${examples[0]}`);
    }

    return parts.join("\n\n");
  },
};
