<script setup lang="ts">
interface Props {
  fileTypeFilter: string;
  dateFilter: string;
  relevanceFilter: string;
}

interface Emits {
  (e: "update:fileTypeFilter", value: string): void;
  (e: "update:dateFilter", value: string): void;
  (e: "update:relevanceFilter", value: string): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();
</script>

<template>
  <div class="flex gap-2">
    <select
      :value="fileTypeFilter"
      class="border-input bg-muted text-foreground focus-visible:ring-ring rounded-md border px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-1"
      @change="emit('update:fileTypeFilter', ($event.target as HTMLSelectElement).value)"
    >
      <option value="">All Types</option>
      <option value=".ts">TypeScript</option>
      <option value=".js">JavaScript</option>
      <option value=".py">Python</option>
      <option value=".java">Java</option>
      <option value=".go">Go</option>
      <option value=".rs">Rust</option>
    </select>
    <select
      :value="dateFilter"
      class="border-input bg-muted text-foreground focus-visible:ring-ring rounded-md border px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-1"
      @change="emit('update:dateFilter', ($event.target as HTMLSelectElement).value)"
    >
      <option value="">All Dates</option>
      <option value="today">Today</option>
      <option value="week">This Week</option>
      <option value="month">This Month</option>
    </select>
    <select
      :value="relevanceFilter"
      class="border-input bg-muted text-foreground focus-visible:ring-ring rounded-md border px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-1"
      @change="emit('update:relevanceFilter', ($event.target as HTMLSelectElement).value)"
    >
      <option value="">All Relevance</option>
      <option value="high">High</option>
      <option value="medium">Medium</option>
      <option value="low">Low</option>
    </select>
  </div>
</template>

