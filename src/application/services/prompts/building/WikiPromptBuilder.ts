import type { GenerateParams } from "@/llm/types";

export class WikiPromptBuilder {
  static buildWikiPrompt(params: GenerateParams): string {
    const { snippet, languageId, filePath, semanticInfo } = params;

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

    const semanticSection = semanticInfo
      ? [
          `Code Semantic Information:`,
          `- Symbol Name: ${semanticInfo.symbolName}`,
          `- Symbol Kind: ${this.getSymbolKindName(semanticInfo.symbolKind)}`,
          semanticInfo.type ? `- Type: ${semanticInfo.type}` : undefined,
          semanticInfo.isAsync ? `- Execution: Async function (returns Promise)` : undefined,
          semanticInfo.returnType ? `- Return Type: ${semanticInfo.returnType}` : undefined,
          semanticInfo.parameters && semanticInfo.parameters.length > 0
            ? `- Parameters:\n${semanticInfo.parameters.map((p) => `  - ${p.name}${p.type ? `: ${p.type}` : ""}`).join("\n")}`
            : undefined,
          semanticInfo.documentation ? `- Documentation: ${semanticInfo.documentation}` : undefined,
        ]
          .filter(Boolean)
          .join("\n")
      : undefined;

    const proj = params.project;
    const projectSection = proj
      ? [
          `Project Context:`,
          proj.rootName ? `- Project Name: ${proj.rootName}` : undefined,
          proj.overview ? `- Project Overview: ${proj.overview}` : undefined,
          proj.filesSample && proj.filesSample.length
            ? `- Project Structure:\n${proj.filesSample.map((p: string) => `  - ${p}`).join("\n")}`
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

IMPORTANT: The title must be short, concise, and relevant - less than 36 characters (including spaces). Keep it brief and descriptive.

For example:
- # UserService - Auth Handler
- # DataProcessor - Input Validator
- # ButtonComponent - UI Renderer
- # calculateTotal - Sum Calculator

If no clear name exists, use the filename or a descriptive name based on functionality. Always ensure the title is under 36 characters.

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

    const finalPrompt = [
      systemPrompt,
      context,
      semanticSection,
      projectSection,
      strictInstructions,
      codeSection,
    ]
      .filter(Boolean)
      .join("\n\n");

    return finalPrompt;
  }

  private static getSymbolKindName(kind: number): string {
    const kindMap: Record<number, string> = {
      1: "File",
      2: "Module",
      3: "Namespace",
      4: "Package",
      5: "Class",
      6: "Method",
      7: "Property",
      8: "Field",
      9: "Constructor",
      10: "Enum",
      11: "Interface",
      12: "Function",
      13: "Variable",
      14: "Constant",
      15: "String",
      16: "Number",
      17: "Boolean",
      18: "Array",
      19: "Object",
      20: "Key",
      21: "Null",
      22: "EnumMember",
      23: "Struct",
      24: "Event",
      25: "Operator",
      26: "TypeParameter",
    };
    return kindMap[kind] || "Unknown";
  }
}
