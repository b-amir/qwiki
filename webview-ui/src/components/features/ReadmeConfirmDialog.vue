<script setup lang="ts">
interface ChangeSummary {
  added: number;
  updated: number;
  removed: number;
  preserved: number;
  warnings: number;
}

interface Props {
  changeSummary: ChangeSummary | null;
  backupOriginal: boolean;
}

interface Emits {
  (e: "confirm"): void;
  (e: "cancel"): void;
}

defineProps<Props>();
const emit = defineEmits<Emits>();
</script>

<template>
  <div
    class="bg-background/80 fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm"
    @click.self="emit('cancel')"
  >
    <div class="bg-background border-border w-full max-w-lg rounded-lg border p-6 shadow-lg">
      <h3 class="mb-4 text-lg font-semibold">Confirm README Update</h3>
      <div v-if="changeSummary" class="mb-4 space-y-2 text-sm">
        <div>This will make the following changes:</div>
        <ul class="list-disc space-y-1 pl-5">
          <li v-if="changeSummary.added > 0">{{ changeSummary.added }} section(s) added</li>
          <li v-if="changeSummary.updated > 0">{{ changeSummary.updated }} section(s) updated</li>
          <li v-if="changeSummary.removed > 0">{{ changeSummary.removed }} section(s) removed</li>
          <li v-if="changeSummary.preserved > 0">
            {{ changeSummary.preserved }} section(s) preserved
          </li>
        </ul>
        <div v-if="backupOriginal" class="text-muted-foreground mt-2 text-xs">
          A backup will be created automatically
        </div>
      </div>
      <div class="flex justify-end gap-2">
        <button
          class="border-border hover:bg-accent rounded-md border px-4 py-2 text-sm"
          @click="emit('cancel')"
        >
          Cancel
        </button>
        <button
          class="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium"
          @click="emit('confirm')"
        >
          Confirm Update
        </button>
      </div>
    </div>
  </div>
</template>
