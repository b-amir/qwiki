<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from "vue";
import MarkdownIt from "markdown-it";
import { vscode } from "@/utilities/vscode";
import { hljs, ensureLanguageLoaded } from "@/utilities/highlightLanguageLoader";
import { detectLanguagesInMarkdown, detectCodeBlocks } from "@/utilities/markdownLanguageDetector";

const props = defineProps<{ content: string }>();
const container = ref<HTMLElement | null>(null);

const commonLanguages = [
  "typescript",
  "javascript",
  "json",
  "css",
  "html",
  "xml",
  "markdown",
  "bash",
  "shell",
  "python",
  "java",
  "go",
  "rust",
  "cpp",
  "c",
  "yaml",
  "sql",
  "vue",
  "tsx",
  "jsx",
];

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function highlightCode(str: string, lang: string | null): string {
  try {
    if (lang) {
      const normalized = lang.toLowerCase().trim();
      const langDef = hljs.getLanguage(normalized);
      if (langDef) {
        return `<pre class="hljs"><code>${hljs.highlight(str, { language: normalized, ignoreIllegals: true }).value}</code></pre>`;
      }
    }

    try {
      const autoResult = hljs.highlightAuto(str);
      if (autoResult && autoResult.value) {
        return `<pre class="hljs"><code>${autoResult.value}</code></pre>`;
      }
    } catch {}

    return `<pre class="hljs"><code>${escapeHtml(str)}</code></pre>`;
  } catch {
    return `<pre class="hljs"><code>${escapeHtml(str)}</code></pre>`;
  }
}

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  highlight: highlightCode,
});

function linkifyFiles(input: string): string {
  if (!input || typeof input !== "string") return "";
  const lines = input.split(/\r?\n/);
  let inFence = false;
  const fenceRe = /^\s*```/;

  const bracketFileLine =
    /^\s*\[([^\]]+?\.(?:tsx?|jsx?|vue|css|scss|less|json|md|mjs|cjs|ya?ml|py|go|java|kt|rs|cs|php|rb))\](\:(?!\/\/))?/i;

  const fileRe =
    /(^|[\s(])((?:\.{1,2}[\\\/]|@\/|[A-Za-z]:[\\\/]|\/)?[A-Za-z0-9._\-\/\\]+?\.(?:tsx?|jsx?|vue|css|scss|less|json|md|mjs|cjs|ya?ml|py|go|java|kt|rs|cs|php|rb))(?:\:(\d+))?(?=$|[\s)\],;:\.'"])/g;
  const encode = (s: string) => s.replace(/\)/g, "%29");
  return lines
    .map((line) => {
      if (fenceRe.test(line)) {
        inFence = !inFence;
        return line;
      }
      if (inFence) return line;

      const m = line.match(bracketFileLine);
      if (m) {
        const label = m[1];
        const href = `openfile:${encode(label)}`;
        return line.replace(bracketFileLine, `[${label}](${href})`);
      }
      return line.replace(fileRe, (_m, pre, path, ln) => {
        const href = `openfile:${encode(path)}${ln ? ":" + ln : ""}`;
        return `${pre}[${path}](${href})`;
      });
    })
    .join("\n");
}

async function render() {
  if (container.value) {
    let content = props.content || "";
    if (typeof content !== "string") {
      content = String(content || "");
    }

    const languages = detectLanguagesInMarkdown(content);
    const codeBlocks = detectCodeBlocks(content);

    const languagesToLoad = new Set<string>();
    for (const lang of languages) {
      languagesToLoad.add(lang);
    }

    const hasUntaggedBlocks = codeBlocks.some((block) => !block.lang);
    if (hasUntaggedBlocks || codeBlocks.length === 0) {
      languagesToLoad.add("javascript");
      languagesToLoad.add("typescript");
      languagesToLoad.add("css");
      languagesToLoad.add("json");
      languagesToLoad.add("html");
      languagesToLoad.add("xml");
      languagesToLoad.add("bash");
    }

    const loadPromises = Array.from(languagesToLoad).map((lang) => ensureLanguageLoaded(lang));
    await Promise.all(loadPromises);

    const linked = linkifyFiles(content);

    container.value.innerHTML = md.render(linked);
  }
}

function handleLinkClicks(e: MouseEvent) {
  const target = e.target as HTMLElement;
  if (!target) return;
  const anchor = (target.closest && target.closest("a")) as HTMLAnchorElement | null;
  if (!anchor) return;
  const href = anchor.getAttribute("href") || "";
  if (!href) return;
  if (/^(https?:|mailto:)/i.test(href)) return;

  e.preventDefault();
  let path = href;
  let line: number | undefined;

  const mOpen = /^openfile:(.+)$/i.exec(href);
  if (mOpen) {
    const rest = decodeURIComponent(mOpen[1]);
    if (rest && typeof rest === "string") {
      const lineMatch = rest.match(/:(\d+)$/);
      if (lineMatch) {
        line = Number(lineMatch[1]);
        path = rest.slice(0, -lineMatch[0].length);
      } else {
        path = rest;
      }
    } else {
      path = href;
    }
  } else if (/^file:\/\//i.test(href)) {
    path = href.replace(/^file:\/\//i, "");
    path = decodeURIComponent(path);
  } else {
    path = href.replace(/^\.\//, "");
  }

  vscode.postMessage({ command: "openFile", payload: { path, line } });
}

onMounted(async () => {
  await Promise.all(commonLanguages.map((lang) => ensureLanguageLoaded(lang)));
  container.value?.addEventListener("click", handleLinkClicks);
  await render();
});
onBeforeUnmount(() => {
  container.value?.removeEventListener("click", handleLinkClicks);
});
watch(() => props.content, render);
</script>

<template>
  <div
    ref="container"
    class="prose prose-invert min-w-0 max-w-none overflow-x-hidden text-sm"
  ></div>
</template>

<style scoped>
/* Enhanced code block styling for syntax highlighting */
.prose :where(pre.hljs) {
  margin: 1rem 0;
  background-color: var(--vscode-editor-background, var(--background)) !important;
  border: 1px solid var(--vscode-panel-border, var(--border));
  border-radius: 0.5rem;
  padding: 1rem;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
  line-height: 1.6;
  font-size: 0.875rem;
  color: var(--vscode-editor-foreground, var(--foreground));
}

.prose :where(pre code) {
  background-color: transparent !important;
  padding: 0;
  border: none;
  font-family:
    ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
}

.prose :where(code:not(pre code)) {
  @apply bg-muted rounded px-1.5 py-0.5;
  font-size: 0.875em;
  font-family:
    ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  font-weight: 500;
  border: 1px solid var(--border);
  opacity: 0.95;
}

.prose :where(pre code, .hljs code) {
  background-image: none !important;
}

/* Highlight.js syntax highlighting - use VS Code editor colors */
.prose .hljs {
  background: var(--vscode-editor-background, var(--background)) !important;
}

.prose .hljs-keyword,
.prose .hljs-selector-tag,
.prose .hljs-literal,
.prose .hljs-section,
.prose .hljs-link {
  color: var(--vscode-textLink-foreground, #569cd6) !important;
}

.prose .hljs-function .hljs-keyword {
  color: var(--vscode-textLink-foreground, #569cd6) !important;
}

.prose .hljs-subst {
  color: var(--vscode-editor-foreground, var(--foreground)) !important;
}

.prose .hljs-string,
.prose .hljs-title,
.prose .hljs-name,
.prose .hljs-type,
.prose .hljs-attribute,
.prose .hljs-symbol,
.prose .hljs-bullet,
.prose .hljs-addition,
.prose .hljs-variable,
.prose .hljs-template-tag,
.prose .hljs-template-variable {
  color: var(--vscode-terminal-ansiGreen, #ce9178) !important;
}

.prose .hljs-comment,
.prose .hljs-quote,
.prose .hljs-deletion,
.prose .hljs-meta {
  color: var(--vscode-descriptionForeground, #6a9955) !important;
  font-style: italic;
}

.prose .hljs-keyword,
.prose .hljs-selector-tag,
.prose .hljs-literal,
.prose .hljs-doctag,
.prose .hljs-title,
.prose .hljs-section,
.prose .hljs-type,
.prose .hljs-name,
.prose .hljs-strong {
  font-weight: 600;
}

.prose .hljs-number {
  color: var(--vscode-terminal-ansiBrightBlue, #b5cea8) !important;
}

.prose .hljs-emphasis {
  font-style: italic;
}

.prose .hljs-built_in,
.prose .hljs-builtin-name {
  color: var(--vscode-textLink-foreground, #4ec9b0) !important;
}

.prose .hljs-params {
  color: var(--vscode-editor-foreground, var(--foreground)) !important;
}

.prose .hljs-attr {
  color: var(--vscode-textLink-foreground, #9cdcfe) !important;
}

.prose .hljs-tag {
  color: var(--vscode-textLink-foreground, #569cd6) !important;
}

.prose .hljs-regexp,
.prose .hljs-link {
  color: var(--vscode-terminal-ansiGreen, #d16969) !important;
}

/* Ensure proper spacing for first/last elements */
.prose > :first-child {
  margin-top: 0 !important;
}

.prose > :last-child {
  margin-bottom: 0 !important;
}
</style>
