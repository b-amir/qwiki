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
  <div class="border-border flex-shrink-0 border-b p-3 sm:p-4 md:p-5">
    <h2 class="mb-3 text-xs font-semibold sm:mb-4 sm:text-sm md:text-base">Configuration</h2>
    <div class="space-y-3 sm:space-y-4 md:space-y-5">
      <div>
        <label class="flex cursor-pointer items-center gap-2 sm:gap-2.5">
          <input
            :checked="config.preserveCustom"
            type="checkbox"
            class="h-4 w-4 flex-shrink-0 rounded sm:h-[18px] sm:w-[18px]"
            @change="updateConfig({ preserveCustom: ($event.target as HTMLInputElement).checked })"
          />
          <span class="text-xs sm:text-sm md:text-sm">Preserve Custom Sections</span>
        </label>
      </div>
      <div>
        <label class="flex cursor-pointer items-center gap-2 sm:gap-2.5">
          <input
            :checked="config.backupOriginal"
            type="checkbox"
            class="h-4 w-4 flex-shrink-0 rounded sm:h-[18px] sm:w-[18px]"
            @change="updateConfig({ backupOriginal: ($event.target as HTMLInputElement).checked })"
          />
          <span class="text-xs sm:text-sm md:text-sm">Backup Original</span>
        </label>
      </div>
      <div class="flex flex-col gap-2 sm:flex-row sm:gap-2 md:gap-3">
        <button
          :disabled="selectedCount === 0 || previewing || updating"
          class="bg-primary text-primary-foreground hover:bg-primary/90 w-full rounded-md px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50 sm:w-auto sm:flex-1 sm:px-4 sm:py-2.5 sm:text-sm md:px-5 md:py-3"
          @click="emit('preview')"
        >
          {{ previewing ? "Generating..." : "Preview" }}
        </button>
        <button
          :disabled="selectedCount === 0 || updating || previewing"
          class="bg-primary text-primary-foreground hover:bg-primary/90 w-full rounded-md px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50 sm:w-auto sm:flex-1 sm:px-4 sm:py-2.5 sm:text-sm md:px-5 md:py-3"
          @click="emit('update')"
        >
          {{ updating ? "Updating..." : "Update" }}
        </button>
      </div>
      <div v-if="error" class="text-destructive break-words text-xs sm:text-sm md:text-sm">
        {{ error }}
      </div>
    </div>
  </div>
</template>
