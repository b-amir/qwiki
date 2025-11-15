<script setup lang="ts">
import LoadingView from "@/components/LoadingView.vue";

import type { LoadingStepDefinition } from "@/composables/useLoadingViewState";

interface Props {
  isLoading: boolean;
  steps: LoadingStepDefinition[];
  currentStep: string;
}

const props = defineProps<Props>();
</script>

<template>
  <Transition
    enter-active-class="transition-opacity duration-200 ease-out"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition-opacity duration-200 ease-in delay-100"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div
      v-if="props.isLoading"
      class="readme-loading-backdrop bg-muted/95 fixed inset-0 z-50 touch-none backdrop-blur-md will-change-[opacity,backdrop-filter]"
      @wheel.prevent
      @touchmove.prevent
      @scroll.prevent
    ></div>
  </Transition>
  <Transition
    enter-active-class="transition-opacity duration-200 ease-out delay-75"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition-opacity duration-200 ease-in"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div
      v-if="props.isLoading"
      class="readme-loading-content will-change-opacity fixed inset-0 z-50 flex touch-none items-center justify-center"
      @wheel.prevent
      @touchmove.prevent
      @scroll.prevent
    >
      <div class="w-full max-w-md px-4">
        <LoadingView :steps="props.steps" :current-step="props.currentStep" />
      </div>
    </div>
  </Transition>
</template>

<style scoped>
@media (prefers-reduced-motion: reduce) {
  .readme-loading-backdrop,
  .readme-loading-content {
    transition: none !important;
  }
}
</style>
