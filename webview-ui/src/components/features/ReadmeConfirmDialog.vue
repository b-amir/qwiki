<script setup lang="ts">
import { computed } from "vue";
import ReadmeDiffView from "./ReadmeDiffView.vue";
import type { ReadmePreview } from "../../../../src/domain/entities/ReadmeUpdate";

interface ChangeSummary {
  added: number;
  updated: number;
  removed: number;
  preserved: number;
}

interface Props {
  preview: ReadmePreview | null;
  changeSummary: ChangeSummary | null;
  backupOriginal: boolean;
  warnings?: string[];
}

interface Emits {
  (e: "confirm"): void;
  (e: "cancel"): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const showDiff = computed(() => !!props.preview);
</script>

<template>
  <div
    class="bg-muted/95 fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md will-change-[opacity,backdrop-filter]"
    @click.self="emit('cancel')"
  >
    <div class="bg-background border-border w-full max-w-4xl rounded-lg border shadow-lg">
      <div class="border-border flex-shrink-0 border-b p-6">
        <h3 class="text-lg font-semibold">Confirm README Update</h3>
        <p v-if="changeSummary" class="text-muted-foreground mt-1 text-sm">
          Review the changes before applying them to your README
        </p>
      </div>

      <div class="max-h-[60vh] overflow-y-auto p-6">
        <div v-if="changeSummary" class="mb-4 space-y-2">
          <div class="text-sm font-medium">Change Summary:</div>
          <div class="grid grid-cols-4 gap-2 text-sm">
            <div v-if="changeSummary.added > 0" class="text-green-600">
              +{{ changeSummary.added }} added
            </div>
            <div v-if="changeSummary.updated > 0" class="text-yellow-600">
              ~{{ changeSummary.updated }} updated
            </div>
            <div v-if="changeSummary.removed > 0" class="text-red-600">
              -{{ changeSummary.removed }} removed
            </div>
            <div v-if="changeSummary.preserved > 0" class="text-muted-foreground">
              ✓{{ changeSummary.preserved }} preserved
            </div>
          </div>

          <div
            v-if="warnings && warnings.length > 0"
            class="rounded-md border border-yellow-500/20 bg-yellow-500/10 p-3 text-sm"
          >
            <div class="font-medium text-yellow-600">Warnings:</div>
            <ul class="mt-1 list-disc space-y-1 pl-5">
              <li v-for="warning in warnings" :key="warning">{{ warning }}</li>
            </ul>
          </div>

          <div v-if="backupOriginal" class="text-muted-foreground text-xs">
            A backup will be created automatically
          </div>
        </div>

        <div v-if="showDiff && preview" class="h-[400px]">
          <ReadmeDiffView :original="preview.original" :updated="preview.updated" />
        </div>
      </div>

      <div class="border-border flex-shrink-0 border-t p-6">
        <div class="flex justify-end gap-2">
          <button
            class="border-border hover:bg-accent rounded-md border px-4 py-2 text-sm transition-colors"
            @click="emit('cancel')"
          >
            Cancel
          </button>
          <button
            class="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium transition-colors"
            @click="emit('confirm')"
          >
            Confirm Update
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
