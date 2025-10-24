<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import hljs from "highlight.js/lib/common";
import MarkdownIt from "markdown-it";

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

function render() {
  if (container.value) {
    container.value.innerHTML = md.render(props.content || "");
  }
}

onMounted(render);
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

