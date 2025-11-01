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
  aggregations: WikiAggregation[];
}

interface Emits {
  (e: "view", aggregation: WikiAggregation): void;
  (e: "delete", aggregationId: string, event: Event): void;
}

const props = defineProps<Props>();
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
  <div v-if="aggregations.length === 0" class="flex h-full items-center justify-center">
    <div class="text-center">
      <div class="text-foreground mb-2 text-lg font-medium">No aggregations yet</div>
      <div class="text-muted-foreground text-sm">
        Select wikis and create an aggregation to get started.
      </div>
    </div>
  </div>
  <div v-else class="space-y-4 p-4">
    <div
      v-for="aggregation in aggregations"
      :key="aggregation.id"
      class="border-border hover:bg-accent/50 cursor-pointer rounded-lg border p-4 transition-colors"
      @click="emit('view', aggregation)"
    >
      <div class="flex items-start justify-between">
        <div class="min-w-0 flex-1">
          <div class="mb-2 font-semibold">{{ aggregation.title }}</div>
          <div class="text-muted-foreground mb-2 flex gap-4 text-xs">
            <span>{{ aggregation.metadata.totalWikis }} wikis</span>
            <span>{{ formatSize(aggregation.metadata.totalSize) }}</span>
            <span>{{ formatDate(aggregation.createdAt) }}</span>
          </div>
          <div v-if="aggregation.metadata.tags.length > 0" class="flex flex-wrap gap-1">
            <span
              v-for="tag in aggregation.metadata.tags.slice(0, 5)"
              :key="tag"
              class="bg-secondary text-secondary-foreground rounded px-1.5 py-0.5 text-xs"
            >
              {{ tag }}
            </span>
          </div>
        </div>
        <button
          class="text-muted-foreground hover:text-destructive p-1 transition-colors"
          title="Delete aggregation"
          @click.stop="emit('delete', aggregation.id, $event)"
        >
          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
            />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

