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
          ? `- Files Sample:\n${proj.filesSample.map((p) => `  • ${p}`).join("\n")}`
          : undefined,
        proj.related && proj.related.length
          ? `- Related Files & Usages:\n${proj.related
              .map((r) => `  • ${r.path}${r.line ? `:${r.line}` : ""}${r.reason ? ` — ${r.reason}` : ""}${
                r.preview ? `\n      ${r.preview}` : ""
              }`)
              .join("\n")}`
          : undefined,
      ]
        .filter(Boolean)
        .join("\n")
    : undefined;

  const instructions = `Write a helpful, concise, and thorough page with these sections:
- What It Is
- What It Does
- How It Works (with references to relevant APIs)
- Usage Examples (small, focused, runnable where possible)
- Pitfalls & Edge Cases
- Debugging & Fixes (common failure modes with actionable steps)
- Best Practices & Alternatives
- Related Symbols/Files to Explore
 - Project-wide Context & Usages (explain the selection's role relative to the entire codebase, referencing provided project data if any)

Formatting:
- Use Markdown. Prefer lists and short paragraphs.
- Use fenced code blocks with proper language tags.
- Keep it IDE-friendly for a narrow sidebar.`;

  const codeBlock = [
    "Selected Snippet:",
    "```" + (languageId || "") + "\n" + snippet + "\n```",
  ].join("\n");

  return [header, context, projectSection, instructions, codeBlock].filter(Boolean).join("\n\n");
}
