<script setup lang="ts">
interface SavedWiki {
  id: string;
  title: string;
  content: string;
  filePath: string;
  createdAt: Date;
  tags: string[];
}

interface WikiAggregation {
  id: string;
  title: string;
  wikis: SavedWiki[];
  metadata: {
    totalWikis: number;
    totalSize: number;
    languages: string[];
    tags: string[];
  };
  createdAt: Date;
  updatedAt?: Date;
}

interface Props {
  aggregation: WikiAggregation;
}

interface Emits {
  (e: "back"): void;
  (e: "delete", aggregationId: string, event: Event): void;
}

defineProps<Props>();
const emit = defineEmits<Emits>();

const formatDate = (date: Date) => {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
};

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="border-border flex-shrink-0 border-b px-4 py-4">
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <button class="text-muted-foreground hover:text-foreground text-sm" @click="emit('back')">
            ← Back
          </button>
          <h1 class="text-lg font-semibold">{{ aggregation.title }}</h1>
        </div>
        <button
          class="text-muted-foreground hover:text-destructive p-1 transition-colors"
          title="Delete aggregation"
          @click="emit('delete', aggregation.id, $event)"
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
      </div>
      <div class="text-muted-foreground mt-4 flex gap-4 text-sm">
        <span>{{ aggregation.metadata.totalWikis }} wikis</span>
        <span>{{ formatSize(aggregation.metadata.totalSize) }}</span>
        <span>Created {{ formatDate(aggregation.createdAt) }}</span>
      </div>
    </div>
    <div class="flex-1 overflow-y-auto p-4">
      <div class="space-y-4">
        <div
          v-for="wiki in aggregation.wikis"
          :key="wiki.id"
          class="border-border rounded-lg border p-4"
        >
          <h3 class="mb-2 font-semibold">{{ wiki.title }}</h3>
          <div class="text-muted-foreground mb-2 text-xs">{{ wiki.filePath }}</div>
          <div class="prose prose-sm max-w-none">
            <div class="text-sm">{{ wiki.content.substring(0, 500) }}...</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
