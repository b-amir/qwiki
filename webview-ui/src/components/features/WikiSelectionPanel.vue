<script setup lang="ts">
import { computed } from "vue";

interface SavedWiki {
  id: string;
  title: string;
  content: string;
  filePath: string;
  createdAt: Date;
  tags: string[];
}

interface Props {
  wikis: SavedWiki[];
  selectedWikis: Set<string>;
  searchQuery: string;
}

interface Emits {
  (e: "update:selectedWikis", value: Set<string>): void;
  (e: "update:searchQuery", value: string): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const filteredWikis = computed(() => {
  if (!props.searchQuery.trim()) return props.wikis;

  const query = props.searchQuery.toLowerCase();
  return props.wikis.filter(
    (wiki) =>
      wiki.title.toLowerCase().includes(query) ||
      wiki.content.toLowerCase().includes(query) ||
      wiki.tags.some((tag) => tag.toLowerCase().includes(query)),
  );
});

const allSelected = computed(
  () => props.selectedWikis.size === filteredWikis.value.length && filteredWikis.value.length > 0,
);

const someSelected = computed(
  () => props.selectedWikis.size > 0 && props.selectedWikis.size < filteredWikis.value.length,
);

const selectWiki = (wikiId: string, checked: boolean) => {
  const newSet = new Set(props.selectedWikis);
  if (checked) {
    newSet.add(wikiId);
  } else {
    newSet.delete(wikiId);
  }
  emit("update:selectedWikis", newSet);
};

const selectAll = () => {
  const newSet = new Set<string>();
  if (!allSelected.value) {
    filteredWikis.value.forEach((wiki) => newSet.add(wiki.id));
  }
  emit("update:selectedWikis", newSet);
};

const updateSearchQuery = (value: string) => {
  emit("update:searchQuery", value);
};
</script>

<template>
  <div class="border-border flex w-96 flex-col border-r">
    <div class="border-border flex-shrink-0 border-b p-4">
      <h2 class="mb-4 text-sm font-semibold">Select Wikis</h2>
      <div class="mb-4">
        <input
          :value="searchQuery"
          type="text"
          placeholder="Search wikis..."
          class="border-input bg-muted text-foreground placeholder:text-muted-foreground focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
          @input="updateSearchQuery(($event.target as HTMLInputElement).value)"
        />
      </div>
      <div class="flex items-center justify-between">
        <label class="text-sm">
          <input
            type="checkbox"
            :checked="allSelected"
            :indeterminate="someSelected"
            class="mr-2"
            @change="selectAll()"
          />
          Select All ({{ selectedWikis.size }})
        </label>
      </div>
    </div>
    <div class="flex-1 overflow-y-auto">
      <div v-if="filteredWikis.length === 0" class="p-4 text-center text-sm text-muted-foreground">
        No wikis available
      </div>
      <div v-else class="divide-border divide-y">
        <label
          v-for="wiki in filteredWikis"
          :key="wiki.id"
          class="hover:bg-accent/50 flex cursor-pointer items-start gap-3 p-3 transition-colors"
        >
          <input
            type="checkbox"
            :checked="selectedWikis.has(wiki.id)"
            class="mt-1"
            @change="selectWiki(wiki.id, ($event.target as HTMLInputElement).checked)"
          />
          <div class="min-w-0 flex-1">
            <div class="text-sm font-medium">{{ wiki.title }}</div>
            <div class="text-muted-foreground mt-1 text-xs">{{ wiki.filePath }}</div>
            <div v-if="wiki.tags.length > 0" class="mt-1 flex flex-wrap gap-1">
              <span
                v-for="tag in wiki.tags.slice(0, 2)"
                :key="tag"
                class="bg-secondary text-secondary-foreground rounded px-1.5 py-0.5 text-xs"
              >
                {{ tag }}
              </span>
            </div>
          </div>
        </label>
      </div>
    </div>
  </div>
</template>

