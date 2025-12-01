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
      <div class="modal-header-title min-w-0 flex-1 overflow-hidden">
        <slot />
      </div>
      <button
        v-if="showCloseButton"
        class="text-muted-foreground hover:text-foreground relative z-10 flex-shrink-0 rounded-md p-1 transition-colors"
        @click="handleClose"
      >
        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.modal-header-title {
  position: relative;
  padding-right: 2.75rem;
}

.modal-header-title::after {
  content: "";
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 3rem;
  background: linear-gradient(to right, transparent 0%, transparent 30%, var(--background) 100%);
  pointer-events: none;
  z-index: 1;
}

.modal-header-title > * {
  position: relative;
  z-index: 0;
}

.modal-header-title h1,
.modal-header-title h2,
.modal-header-title h3,
.modal-header-title h4,
.modal-header-title h5,
.modal-header-title h6 {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.modal-header-title > div {
  min-width: 0;
}

.modal-header-title > div > h1,
.modal-header-title > div > h2,
.modal-header-title > div > h3,
.modal-header-title > div > h4,
.modal-header-title > div > h5,
.modal-header-title > div > h6 {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
</style>
