<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from "vue";
import MarkdownIt from "markdown-it";
import { vscode } from "@/utilities/vscode";
import { hljs, ensureLanguageLoaded } from "@/utilities/highlightLanguageLoader";
import { detectLanguagesInMarkdown } from "@/utilities/markdownLanguageDetector";

const props = defineProps<{ content: string }>();
const container = ref<HTMLElement | null>(null);

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
      if (hljs.getLanguage(normalized)) {
        return `<pre class="hljs"><code>${hljs.highlight(str, { language: normalized, ignoreIllegals: true }).value}</code></pre>`;
      }
    }
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
    content = content.replace(/^#\s+.+$/m, "");

    const languages = detectLanguagesInMarkdown(content);
    const loadPromises = Array.from(languages).map((lang) => ensureLanguageLoaded(lang));
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

onMounted(() => {
  render();
  container.value?.addEventListener("click", handleLinkClicks);
});
onBeforeUnmount(() => {
  container.value?.removeEventListener("click", handleLinkClicks);
});
watch(() => props.content, render);
</script>

<template>
  <div ref="container" class="prose prose-invert max-w-none text-sm"></div>
</template>

<style scoped>
.prose :where(pre.hljs) {
  margin: 1rem 0;
  background-color: var(--vscode-editor-background, var(--background)) !important;
  border: 1px solid var(--vscode-panel-border, var(--border));
  border-radius: 0.375rem;
  padding: 0.75rem;
}

.prose :where(pre code) {
  background-color: transparent !important;
  padding: 0;
}

.prose :where(code:not(pre code)) {
  @apply bg-muted rounded px-1 py-0.5;
}

.prose :where(pre code, .hljs code) {
  background-image: none !important;
}
</style>
