export function detectLanguagesInMarkdown(content: string): Set<string> {
  const languages = new Set<string>();
  if (!content || typeof content !== "string") {
    return languages;
  }

  const codeBlockRegex = /```(\w+)?[\s\n\r]/g;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    const lang = match[1];
    if (lang) {
      languages.add(lang.toLowerCase().trim());
    }
  }

  return languages;
}

export function detectCodeBlocks(content: string): Array<{ lang: string | null; content: string }> {
  const blocks: Array<{ lang: string | null; content: string }> = [];
  if (!content || typeof content !== "string") {
    return blocks;
  }

  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    const lang = match[1] ? match[1].toLowerCase().trim() : null;
    const blockContent = match[2] || "";
    blocks.push({ lang, content: blockContent });
  }

  return blocks;
}
