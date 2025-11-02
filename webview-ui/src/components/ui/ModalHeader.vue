<script setup lang="ts">
interface Props {
  showCloseButton?: boolean;
}

interface Emits {
  (e: "close"): void;
}

withDefaults(defineProps<Props>(), {
  showCloseButton: true,
});

const emit = defineEmits<Emits>();

const handleClose = () => {
  emit("close");
};
</script>

<template>
  <div class="border-border flex-shrink-0 border-b px-4 py-3 sm:px-6 sm:py-4">
    <div class="flex items-center justify-between gap-4">
      <div class="min-w-0 flex-1">
        <slot />
      </div>
      <button
        v-if="showCloseButton"
        class="text-muted-foreground hover:text-foreground flex-shrink-0 rounded-md p-1 transition-colors"
        @click="handleClose"
      >
        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  </div>
</template>
