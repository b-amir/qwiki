import type { GenerateParams } from "./types";

export function buildWikiPrompt(params: GenerateParams) {
  const { snippet, languageId, filePath } = params;
  const header = `You are a coding assistant generating a context-aware wiki page for a code selection inside an IDE sidebar.`;
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
        proj.rootName ? `- Root: ${proj.rootName}` : undefined,
        proj.overview ? `- Overview: ${proj.overview}` : undefined,
        proj.filesSample && proj.filesSample.length
          ? `- Files Sample:\n${proj.filesSample.map((p) => `  - ${p}`).join("\n")}`
          : undefined,
        proj.related && proj.related.length
          ? `- Related Files & Usages:\n${proj.related
              .map(
                (r) =>
                  `  - ${r.path}${r.line ? `:${r.line}` : ""}${r.reason ? ` (${r.reason})` : ""}${
                    r.preview ? `\n      ${r.preview}` : ""
                  }`,
              )
              .join("\n")}`
          : undefined,
      ]
        .filter(Boolean)
        .join("\n")
    : undefined;

  const instructions = `Output policy (strict):
Return ONLY Markdown. Do not include any surrounding commentary.
Start with a single H1 title inferred from the selection (e.g., component or symbol name):

# <Title>

Then emit the following sections using EXACT H2 headings (do not bold them):

## What It Is
## What It Does
## How It Works
## Usage Examples
## Pitfalls & Edge Cases
## Debugging & Fixes
## Best Practices & Alternatives
## Related Symbols/Files to Explore
## Project-wide Context & Usages

Formatting rules:
- Use Markdown; keep paragraphs short, prefer bullet lists.
- Always leave a blank line between headings and content.
- Use fenced code blocks with language tags for examples.
- When you mention repo files, make them clickable using Markdown links in this form: [path](openfile:path) or [path:line](openfile:path:line). Prefer workspace-relative paths.
- Avoid HTML tags and tables unless necessary.
- Do not invent files; prefer those from Project Context if relevant.`;

  const codeBlock = [
    "Selected Snippet:",
    "```" + (languageId || "") + "\n" + snippet + "\n```",
  ].join("\n");

  return [header, context, projectSection, instructions, codeBlock].filter(Boolean).join("\n\n");
}
