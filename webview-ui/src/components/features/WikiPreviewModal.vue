<script setup lang="ts">
import { computed } from "vue";
import MarkdownRenderer from "@/components/MarkdownRenderer.vue";

interface SavedWiki {
  id: string;
  title: string;
  content: string;
  filePath: string;
  createdAt: Date;
  tags: string[];
}

interface Props {
  wiki: SavedWiki | null;
}

interface Emits {
  (e: "close"): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const wikiContentWithoutTitle = computed(() => {
  if (!props.wiki?.content) return "";
  const content =
    typeof props.wiki.content === "string" ? props.wiki.content : String(props.wiki.content);
  return content.replace(/^#\s+.+$/m, "");
});
</script>

<template>
  <div
    v-if="wiki"
    class="bg-background/80 fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm"
    @click.self="emit('close')"
  >
    <div
      class="bg-background border-border flex h-[80vh] w-[90vw] max-w-4xl flex-col rounded-lg border shadow-lg"
    >
      <div class="border-border flex-shrink-0 border-b px-6 py-4">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-lg font-semibold">{{ wiki.title }}</h2>
            <div class="text-muted-foreground mt-1 text-sm">{{ wiki.filePath }}</div>
          </div>
          <button
            class="text-muted-foreground hover:text-foreground rounded-md p-1 transition-colors"
            @click="emit('close')"
          >
            <svg
              class="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
      <div class="flex-1 overflow-y-auto p-6">
        <MarkdownRenderer :content="wikiContentWithoutTitle" />
      </div>
    </div>
  </div>
</template>
