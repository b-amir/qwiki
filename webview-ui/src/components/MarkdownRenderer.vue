<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from "vue";
import hljs from "highlight.js/lib/common";
import MarkdownIt from "markdown-it";
import { vscode } from "@/utilities/vscode";

const props = defineProps<{ content: string }>();
const container = ref<HTMLElement | null>(null);

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  highlight(str, lang) {
    try {
      if (lang && hljs.getLanguage(lang)) {
        return `<pre class="hljs"><code>${hljs.highlight(str, { language: lang, ignoreIllegals: true }).value}</code></pre>`;
      }
      return `<pre class="hljs"><code>${hljs.highlightAuto(str).value}</code></pre>`;
    } catch (e) {
      return `<pre class="hljs"><code>${md.utils.escapeHtml(str)}</code></pre>`;
    }
  },
});

// Replace plain file-like references with markdown links that our click handler can open
function linkifyFiles(input: string): string {
  // Skip fenced code blocks while still allowing inline code to be linkified
  const lines = input.split(/\r?\n/);
  let inFence = false;
  const fenceRe = /^\s*```/;
  const fileRe = /(^|[\s(\[])((?:\.{1,2}[\\\/]|[A-Za-z]:[\\\/]|\/)?[A-Za-z0-9._\-\/\\]+?\.(?:tsx?|jsx?|vue|css|scss|less|json|md|mjs|cjs|ya?ml|py|go|java|kt|rs|cs|php|rb))(?:\:(\d+))?(?=$|[\s)\],;])/g;
  const encode = (s: string) => s.replace(/\)/g, "%29");
  return lines
    .map((line) => {
      if (fenceRe.test(line)) {
        inFence = !inFence;
        return line;
      }
      if (inFence) return line;
      return line.replace(fileRe, (_m, pre, path, ln) => {
        const href = `openfile:${encode(path)}${ln ? ":" + ln : ""}`;
        return `${pre}[${path}](${href})`;
      });
    })
    .join("\n");
}

function render() {
  if (container.value) {
    const content = props.content || "";
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
  // Ignore external links (http/https/mailto)
  if (/^(https?:|mailto:)/i.test(href)) return;

  e.preventDefault();
  // Supported formats:
  // - openfile:relative/path[:line]
  // - file:///abs/path or file://C:/path
  // - workspace-relative plain paths like src/foo.ts or ./bar/baz.ts
  let path = href;
  let line: number | undefined;

  const mOpen = /^openfile:(.+)$/i.exec(href);
  if (mOpen) {
    const rest = decodeURIComponent(mOpen[1]);
    const parts = rest.split(":");
    path = parts[0];
    if (parts[1]) {
      const n = Number(parts[1]);
      if (!Number.isNaN(n)) line = n;
    }
  } else if (/^file:\/\//i.test(href)) {
    // Strip file:// scheme
    path = href.replace(/^file:\/\//i, "");
    // On Windows, keep drive like C:/
    path = decodeURIComponent(path);
  } else {
    // Treat as workspace-relative or ./ relative
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
.prose :where(pre) {
  background: transparent;
}
</style>

