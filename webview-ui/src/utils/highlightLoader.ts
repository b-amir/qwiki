import hljs from "highlight.js/lib/core";
import type { LanguageFn } from "highlight.js";

const loadedLanguages = new Set<string>();

const languageMap: Record<string, () => Promise<{ default: LanguageFn }>> = {
  typescript: () => import("highlight.js/lib/languages/typescript"),
  javascript: () => import("highlight.js/lib/languages/javascript"),
  json: () => import("highlight.js/lib/languages/json"),
  css: () => import("highlight.js/lib/languages/css"),
  html: () => import("highlight.js/lib/languages/xml"),
  xml: () => import("highlight.js/lib/languages/xml"),
  markdown: () => import("highlight.js/lib/languages/markdown"),
  bash: () => import("highlight.js/lib/languages/bash"),
  shell: () => import("highlight.js/lib/languages/bash"),
  python: () => import("highlight.js/lib/languages/python"),
  java: () => import("highlight.js/lib/languages/java"),
  go: () => import("highlight.js/lib/languages/go"),
  rust: () => import("highlight.js/lib/languages/rust"),
  cpp: () => import("highlight.js/lib/languages/cpp"),
  c: () => import("highlight.js/lib/languages/c"),
  yaml: () => import("highlight.js/lib/languages/yaml"),
  sql: () => import("highlight.js/lib/languages/sql"),
  vue: () => import("highlight.js/lib/languages/xml"),
  tsx: () => import("highlight.js/lib/languages/typescript"),
  jsx: () => import("highlight.js/lib/languages/javascript"),
};

export async function loadLanguage(lang: string): Promise<void> {
  const normalizedLang = lang.toLowerCase();
  if (loadedLanguages.has(normalizedLang)) {
    return;
  }

  const loader = languageMap[normalizedLang];
  if (loader) {
    try {
      const languageModule = await loader();
      const language = languageModule.default;
      hljs.registerLanguage(normalizedLang, language);
      loadedLanguages.add(normalizedLang);
    } catch (error) {
      console.warn(`Failed to load highlight.js language: ${normalizedLang}`, error);
    }
  }
}

export function highlightCode(code: string, language?: string): string {
  if (!language) {
    try {
      return hljs.highlightAuto(code).value;
    } catch {
      return hljs.highlightAuto(code).value;
    }
  }

  const normalizedLang = language.toLowerCase().trim();
  if (!normalizedLang) {
    return hljs.highlightAuto(code).value;
  }

  try {
    if (hljs.getLanguage(normalizedLang)) {
      return hljs.highlight(code, { language: normalizedLang, ignoreIllegals: true }).value;
    }
  } catch {
    return hljs.highlightAuto(code).value;
  }

  return hljs.highlightAuto(code).value;
}
