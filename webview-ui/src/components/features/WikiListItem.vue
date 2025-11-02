<script setup lang="ts">
interface SavedWiki {
  id: string;
  title: string;
  content: string;
  filePath: string;
  createdAt: Date;
  tags: string[];
}

interface Props {
  wiki: SavedWiki;
  selected?: boolean;
}

interface Emits {
  (e: "preview", wiki: SavedWiki, event: Event): void;
  (e: "delete", wikiId: string, event: Event): void;
  (e: "open", wiki: SavedWiki): void;
}

defineProps<Props>();
const emit = defineEmits<Emits>();

const formatCreatedAt = (date: Date) => {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
};
</script>

<template>
  <div
    class="hover:bg-accent/50 group relative cursor-pointer transition-colors"
    @click="emit('open', wiki)"
  >
    <div class="p-4">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0 flex-1">
          <div class="mb-1 truncate text-sm font-medium">{{ wiki.title }}</div>
          <div class="text-muted-foreground mb-2 text-xs">
            {{ formatCreatedAt(wiki.createdAt) }}
          </div>
          <div v-if="wiki.tags.length > 0" class="flex flex-wrap gap-1">
            <span
              v-for="tag in wiki.tags.slice(0, 3)"
              :key="tag"
              class="bg-secondary text-secondary-foreground rounded px-1.5 py-0.5 text-xs"
            >
              {{ tag }}
            </span>
            <span v-if="wiki.tags.length > 3" class="text-muted-foreground text-xs">
              +{{ wiki.tags.length - 3 }}
            </span>
          </div>
        </div>
        <div class="flex flex-shrink-0 items-center gap-2">
          <button
            class="text-muted-foreground hover:text-foreground p-1 transition-colors"
            title="Preview wiki"
            @click.stop="emit('preview', wiki, $event)"
          >
            <svg
              class="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
              />
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </button>
          <button
            class="text-muted-foreground hover:text-destructive p-1 transition-colors"
            title="Delete wiki"
            @click.stop="emit('delete', wiki.id, $event)"
          >
            <svg
              class="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
              />
            </svg>
          </button>
          <div
            class="text-muted-foreground group-hover:text-foreground translate-x-[-4px] opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100"
          >
            <svg
              class="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
