<template>
  <div
    class="bg-muted inline-block h-3 animate-pulse rounded leading-4 sm:h-4 sm:rounded-md"
    :style="computedStyle"
  ></div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  style?: Record<string, string>;
}>();

const computedStyle = computed(() => {
  const skeletonCh = props.style?.["--skeleton-ch"];
  const charCount = skeletonCh ? parseInt(skeletonCh, 10) : 20;
  const width = `${charCount}ch`;

  return {
    ...props.style,
    width,
    maxWidth: "100%",
  };
});
</script>
