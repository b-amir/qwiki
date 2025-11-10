<script setup lang="ts">
import { computed } from "vue";
import Button from "@/components/ui/button.vue";
import type { ReadmeUpdateState, UndoReadmeState } from "./useSavedWikisPage";

interface Props {
  hasBackup: boolean;
  updateState: ReadmeUpdateState;
  undoState: UndoReadmeState;
  isSynced: boolean;
  diffAvailable: boolean;
}

interface Emits {
  (event: "update"): void;
  (event: "undo"): void;
  (event: "showDiff"): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const isUndoDisabled = computed(
  () => props.undoState === "loading" || props.updateState === "loading",
);

const isUpdateDisabled = computed(
  () => props.updateState === "loading" || props.undoState === "loading",
);

const isDiffDisabled = computed(
  () => !props.diffAvailable || props.undoState === "loading" || props.updateState === "loading",
);

const updateLabel = computed(() => {
  if (props.updateState === "loading") {
    return "Updating...";
  }
  if (props.updateState === "done") {
    return "Done";
  }
  return "Update README";
});

const handleUndo = () => {
  if (props.hasBackup && !isUndoDisabled.value) {
    emit("undo");
  }
};

const handleUpdate = () => {
  if (!isUpdateDisabled.value) {
    emit("update");
  }
};

const handleShowDiff = () => {
  if (!isDiffDisabled.value) {
    emit("showDiff");
  }
};
</script>

<template>
  <div class="border-border bg-background flex-shrink-0 border-t px-4 py-4">
    <p
      v-if="props.isSynced"
      class="text-muted-foreground mb-3 flex items-center justify-center gap-2 text-xs font-medium tracking-wide"
    >
      README is synced with saved wikis.
    </p>
    <div class="flex gap-2">
      <Transition
        enter-active-class="undo-button-enter-active"
        enter-from-class="undo-button-enter-from"
        enter-to-class="undo-button-enter-to"
        leave-active-class="undo-button-leave-active"
        leave-from-class="undo-button-leave-from"
        leave-to-class="undo-button-leave-to"
      >
        <Button
          v-if="props.hasBackup"
          :disabled="isUndoDisabled"
          class="undo-button bg-muted hover:bg-muted/80 text-foreground flex min-w-[3rem] flex-[0.2] items-center justify-center"
          @click="handleUndo"
        >
          <svg
            v-if="props.undoState === 'loading'"
            class="h-4 w-4 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              class="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="4"
            />
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <svg
            v-else
            class="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
            />
          </svg>
        </Button>
      </Transition>
      <template v-if="props.isSynced">
        <Button
          :disabled="isDiffDisabled"
          class="bg-foreground flex-1 text-sm transition-all"
          @click="handleShowDiff"
        >
          Show Diff
        </Button>
      </template>
      <template v-else>
        <Button
          :disabled="isUpdateDisabled"
          class="bg-foreground flex-1 text-sm transition-all"
          @click="handleUpdate"
        >
          <svg
            v-if="props.updateState === 'loading'"
            class="mr-2 h-4 w-4 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              class="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="4"
            />
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <svg
            v-else-if="props.updateState === 'done'"
            class="mr-2 h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          {{ updateLabel }}
        </Button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.undo-button {
  will-change: transform, opacity;
  contain: layout style paint;
}

.undo-button-enter-active {
  transition:
    transform 160ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 160ms cubic-bezier(0.22, 1, 0.36, 1);
}

.undo-button-enter-from {
  opacity: 0;
  transform: translate3d(-1rem, 0, 0) scale(0.95);
}

.undo-button-enter-to {
  opacity: 1;
  transform: translate3d(0, 0, 0) scale(1);
}

.undo-button-leave-active {
  transition:
    transform 120ms cubic-bezier(0.4, 0, 1, 1),
    opacity 120ms cubic-bezier(0.4, 0, 1, 1);
}

.undo-button-leave-from {
  opacity: 1;
  transform: translate3d(0, 0, 0) scale(1);
}

.undo-button-leave-to {
  opacity: 0;
  transform: translate3d(-1rem, 0, 0) scale(0.95);
}

@media (prefers-reduced-motion: reduce) {
  .undo-button-enter-active,
  .undo-button-leave-active {
    transition: none;
  }

  .undo-button-enter-from,
  .undo-button-leave-to {
    transform: none;
  }
}
</style>
