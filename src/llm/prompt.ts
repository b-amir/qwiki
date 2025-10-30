import type { GenerateParams } from "./types";

export function buildWikiPrompt(params: GenerateParams) {
  const { snippet, languageId, filePath } = params;

  const systemPrompt = `You are an expert technical documentation specialist. Your task is to create accurate, comprehensive documentation for code snippets. Follow these rules strictly:

1. ACCURACY FIRST: Only document what is explicitly visible in the code. Do not speculate about features not present.
2. CONSISTENT FORMAT: Use the exact section structure provided below.
3. CONTEXT-AWARE: Leverage the project context to provide relevant, specific information.
4. CONCISE YET COMPLETE: Be thorough but avoid unnecessary verbosity.
5. REAL EXAMPLES: Use actual code from the snippet when providing examples.`;

  const context = [
    languageId ? `Language: ${languageId}` : undefined,
    filePath ? `File: ${filePath}` : undefined,
  ]
    .filter(Boolean)
    .join("\n");

  const proj = params.project;
  const projectSection = proj
    ? [
        `Project Context:`,
        proj.rootName ? `- Project Name: ${proj.rootName}` : undefined,
        proj.overview ? `- Project Overview: ${proj.overview}` : undefined,
        proj.filesSample && proj.filesSample.length
          ? `- Project Structure:\n${proj.filesSample.map((p) => `  - ${p}`).join("\n")}`
          : undefined,
        proj.related && proj.related.length
          ? `- Related Files & Usages:\n${proj.related
              .map(
                (r) =>
                  `  - [${r.path}${r.line ? `:${r.line}` : ""}](openfile:${r.path}${r.line ? `:${r.line}` : ""})${r.reason ? ` - ${r.reason}` : ""}${
                    r.preview ? `\n    \`${r.preview.trim()}\`` : ""
                  }`,
              )
              .join("\n")}`
          : undefined,
      ]
        .filter(Boolean)
        .join("\n")
    : undefined;

  const strictInstructions = `OUTPUT REQUIREMENTS (NON-NEGOTIABLE):

Return ONLY raw Markdown content. No explanations, no commentary, no "Here is the documentation", just the markdown.

Start with a single H1 title. Extract the actual component/function/class name from the code:

# ComponentName - BriefPurpose

For example:
- # UserService - Handles user authentication
- # DataProcessor - Processes and validates input data
- # ButtonComponent - Renders clickable button UI
- # calculateTotal - Computes sum of values

If no clear name exists, use the filename or a descriptive name based on functionality.

Then create these EXACT sections in this order (use H2 headings exactly as shown):

## What It Is
## What It Does  
## How It Works
## Usage Examples
## Important Considerations
## Related Components

CONTENT GUIDELINES:
- What It Is: Brief technical definition based on actual code
- What It Does: Observable behavior and functionality only
- How It Works: Implementation details visible in the code
- Usage Examples: Real examples using the actual code patterns
- Important Considerations: Edge cases, limitations, requirements
- Related Components: References to files/components in project context

FORMATTING RULES:
- Use fenced code blocks with language identifiers: \`\`\`${languageId || "javascript"}\`
- Keep paragraphs under 3 sentences
- Use bullet points for lists
- Link to project files using: [filename](openfile:path) or [filename:line](openfile:path:line)
- No HTML tables, no complex formatting
- Do not invent functionality or features not present in the code`;

  const codeSection = [
    "CODE TO DOCUMENT:",
    "```" + (languageId || "") + "\n" + snippet + "\n```",
  ].join("\n");

  const finalPrompt = [systemPrompt, context, projectSection, strictInstructions, codeSection]
    .filter(Boolean)
    .join("\n\n");

  return finalPrompt;
}
