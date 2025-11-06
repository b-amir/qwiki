import hljs from "highlight.js/lib/core";
import type { Language } from "highlight.js";

const loadedLanguages = new Set<string>();
const languagePromises = new Map<string, Promise<Language | null>>();

const languageAliases: Record<string, string> = {
  js: "javascript",
  ts: "typescript",
  py: "python",
  sh: "bash",
  yml: "yaml",
  md: "markdown",
};

function normalizeLanguage(lang: string): string {
  const normalized = lang.toLowerCase().trim();
  return languageAliases[normalized] || normalized;
}

async function loadLanguage(lang: string): Promise<Language | null> {
  const normalized = normalizeLanguage(lang);

  if (loadedLanguages.has(normalized)) {
    const langDef = hljs.getLanguage(normalized);
    return langDef || null;
  }

  if (languagePromises.has(normalized)) {
    return languagePromises.get(normalized)!;
  }

  const loadPromise = (async (): Promise<Language | null> => {
    try {
      switch (normalized) {
        case "javascript":
        case "js":
          const js = await import("highlight.js/lib/languages/javascript");
          hljs.registerLanguage("javascript", js.default);
          loadedLanguages.add("javascript");
          return hljs.getLanguage("javascript") || null;
        case "typescript":
        case "ts":
          const ts = await import("highlight.js/lib/languages/typescript");
          hljs.registerLanguage("typescript", ts.default);
          loadedLanguages.add("typescript");
          return hljs.getLanguage("typescript") || null;
        case "python":
        case "py":
          const py = await import("highlight.js/lib/languages/python");
          hljs.registerLanguage("python", py.default);
          loadedLanguages.add("python");
          return hljs.getLanguage("python") || null;
        case "java":
          const java = await import("highlight.js/lib/languages/java");
          hljs.registerLanguage("java", java.default);
          loadedLanguages.add("java");
          return hljs.getLanguage("java") || null;
        case "go":
          const go = await import("highlight.js/lib/languages/go");
          hljs.registerLanguage("go", go.default);
          loadedLanguages.add("go");
          return hljs.getLanguage("go") || null;
        case "rust":
        case "rs":
          const rust = await import("highlight.js/lib/languages/rust");
          hljs.registerLanguage("rust", rust.default);
          loadedLanguages.add("rust");
          return hljs.getLanguage("rust") || null;
        case "css":
          const css = await import("highlight.js/lib/languages/css");
          hljs.registerLanguage("css", css.default);
          loadedLanguages.add("css");
          return hljs.getLanguage("css") || null;
        case "html":
          const htmlLang = await import("highlight.js/lib/languages/xml");
          hljs.registerLanguage("html", htmlLang.default);
          loadedLanguages.add("html");
          return hljs.getLanguage("html") || null;
        case "json":
          const json = await import("highlight.js/lib/languages/json");
          hljs.registerLanguage("json", json.default);
          loadedLanguages.add("json");
          return hljs.getLanguage("json") || null;
        case "markdown":
        case "md":
          const md = await import("highlight.js/lib/languages/markdown");
          hljs.registerLanguage("markdown", md.default);
          loadedLanguages.add("markdown");
          return hljs.getLanguage("markdown") || null;
        case "bash":
        case "sh":
        case "shell":
          const bash = await import("highlight.js/lib/languages/bash");
          hljs.registerLanguage("bash", bash.default);
          loadedLanguages.add("bash");
          return hljs.getLanguage("bash") || null;
        case "yaml":
        case "yml":
          const yaml = await import("highlight.js/lib/languages/yaml");
          hljs.registerLanguage("yaml", yaml.default);
          loadedLanguages.add("yaml");
          return hljs.getLanguage("yaml") || null;
        case "sql":
          const sql = await import("highlight.js/lib/languages/sql");
          hljs.registerLanguage("sql", sql.default);
          loadedLanguages.add("sql");
          return hljs.getLanguage("sql") || null;
        case "xml":
          const xml = await import("highlight.js/lib/languages/xml");
          hljs.registerLanguage("xml", xml.default);
          loadedLanguages.add("xml");
          return hljs.getLanguage("xml") || null;
        default:
          return null;
      }
    } catch {
      return null;
    }
  })();

  languagePromises.set(normalized, loadPromise);
  const result = await loadPromise;
  languagePromises.delete(normalized);
  return result || null;
}

export async function ensureLanguageLoaded(lang: string): Promise<boolean> {
  if (!lang) return false;
  const normalized = normalizeLanguage(lang);
  if (loadedLanguages.has(normalized)) return true;
  const language = await loadLanguage(lang);
  return language !== null;
}

export function getLoadedLanguages(): string[] {
  return Array.from(loadedLanguages);
}

export function isLanguageLoaded(lang: string): boolean {
  return loadedLanguages.has(normalizeLanguage(lang));
}

export { hljs };
