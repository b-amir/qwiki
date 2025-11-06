<script setup lang="ts">
interface Props {
  selectedCount: number;
}

interface Emits {
  (e: "updateReadme"): void;
  (e: "export"): void;
}

defineProps<Props>();
const emit = defineEmits<Emits>();
</script>

<template>
  <div class="border-border bg-muted/50 flex items-center justify-between gap-3 border-b px-4 py-3">
    <div class="text-muted-foreground text-sm">
      {{ selectedCount }} {{ selectedCount === 1 ? "wiki" : "wikis" }} selected
    </div>
    <div class="flex gap-2">
      <button
        class="border-border hover:bg-accent rounded-md border px-3 py-1.5 text-sm"
        @click="emit('updateReadme')"
      >
        Update README.md
      </button>
      <button
        class="border-border hover:bg-accent rounded-md border px-3 py-1.5 text-sm"
        @click="emit('export')"
      >
        Export
      </button>
    </div>
  </div>
</template>
