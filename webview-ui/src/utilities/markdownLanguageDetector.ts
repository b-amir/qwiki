export function detectLanguagesInMarkdown(content: string): Set<string> {
  const languages = new Set<string>();
  if (!content || typeof content !== "string") {
    return languages;
  }

  const codeBlockRegex = /```(\w+)?\n/g;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    const lang = match[1];
    if (lang) {
      languages.add(lang.toLowerCase().trim());
    }
  }

  return languages;
}

