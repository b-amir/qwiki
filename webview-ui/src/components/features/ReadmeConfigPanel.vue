<script setup lang="ts">
interface ReadmeUpdateConfig {
  sections: string[];
  preserveCustom: boolean;
  backupOriginal: boolean;
}

interface Props {
  config: ReadmeUpdateConfig;
  selectedCount: number;
  updating: boolean;
  previewing: boolean;
  error: string | null;
}

interface Emits {
  (e: "update:config", value: ReadmeUpdateConfig): void;
  (e: "preview"): void;
  (e: "update"): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const updateConfig = (updates: Partial<ReadmeUpdateConfig>) => {
  emit("update:config", { ...props.config, ...updates });
};
</script>

<template>
  <div class="border-border flex-shrink-0 border-b p-4">
    <h2 class="mb-4 text-sm font-semibold">Configuration</h2>
    <div class="space-y-4">
      <div>
        <label class="flex cursor-pointer items-center gap-2">
          <input
            :checked="config.preserveCustom"
            type="checkbox"
            class="rounded"
            @change="updateConfig({ preserveCustom: ($event.target as HTMLInputElement).checked })"
          />
          <span class="text-sm">Preserve Custom Sections</span>
        </label>
      </div>
      <div>
        <label class="flex cursor-pointer items-center gap-2">
          <input
            :checked="config.backupOriginal"
            type="checkbox"
            class="rounded"
            @change="updateConfig({ backupOriginal: ($event.target as HTMLInputElement).checked })"
          />
          <span class="text-sm">Backup Original</span>
        </label>
      </div>
      <div class="flex gap-2">
        <button
          :disabled="selectedCount === 0 || previewing || updating"
          class="bg-primary text-primary-foreground hover:bg-primary/90 flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
          @click="emit('preview')"
        >
          {{ previewing ? "Generating..." : "Preview" }}
        </button>
        <button
          :disabled="selectedCount === 0 || updating || previewing"
          class="bg-primary text-primary-foreground hover:bg-primary/90 flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
          @click="emit('update')"
        >
          {{ updating ? "Updating..." : "Update" }}
        </button>
      </div>
      <div v-if="error" class="text-destructive text-sm">{{ error }}</div>
    </div>
  </div>
</template>
