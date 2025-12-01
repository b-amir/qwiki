import type { GenerateParams } from "@/llm/types";

/**
 * HuggingFace (Open-source models) Template
 *
 * Optimized for open-source models (Mistral, Llama, etc.) which:
 * - Work better with simpler, direct prompts
 * - May have smaller context windows
 * - Perform best with clear, concise instructions
 * - Don't need verbose formatting instructions
 *
 * Best practices applied:
 * - Shorter, more direct prompt
 * - Essential information only
 * - Clear task statement upfront
 * - Minimal meta-instructions (models vary in following complex formats)
 */
export const huggingfacePromptTemplate = {
  system: `Write Markdown documentation for code. Include sections: What It Is, What It Does, How It Works, Usage Examples, Important Considerations, Related Components. Be accurate and concise.`,

  buildUserPrompt: (params: GenerateParams, context?: string, examples?: string[]): string => {
    const { snippet, languageId, filePath, semanticInfo, project } = params;

    let prompt = `Document this ${languageId || "code"}:\n\n`;

    prompt += `\`\`\`${languageId || ""}\n${snippet}\n\`\`\`\n\n`;

    const info: string[] = [];
    if (filePath) info.push(`File: ${filePath}`);
    if (semanticInfo?.symbolName) info.push(`Name: ${semanticInfo.symbolName}`);
    if (semanticInfo?.returnType) info.push(`Returns: ${semanticInfo.returnType}`);
    if (project?.rootName) info.push(`Project: ${project.rootName}`);

    if (info.length) {
      prompt += info.join(" | ") + "\n\n";
    }

    prompt += `Write documentation with title (# Name - Purpose) and sections (## What It Is, ## What It Does, ## How It Works, ## Usage Examples, ## Important Considerations, ## Related Components).`;

    return prompt;
  },
};
