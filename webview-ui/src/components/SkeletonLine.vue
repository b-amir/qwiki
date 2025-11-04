<template>
  <div
    class="h-4 max-w-full animate-[skeletonShimmer_0.9s_cubic-bezier(0.2,0.6,0.35,1)_infinite] rounded sm:h-5 sm:rounded-md"
    :style="style"
  ></div>
</template>

<script setup lang="ts">
defineProps<{
  style?: Record<string, string>;
}>();
</script>

<style scoped>
div {
  width: min(calc(var(--skeleton-ch) * 1ch), 100%);
  --skeleton-base: color-mix(in oklab, var(--vscode-widget-border, var(--border)) 80%, transparent);
  --skeleton-highlight: color-mix(
    in oklab,
    var(--primary, var(--vscode-textLink-foreground)) 22%,
    transparent
  );
  background-image: linear-gradient(
    90deg,
    var(--skeleton-base) 0%,
    var(--skeleton-base) 35%,
    var(--skeleton-highlight) 50%,
    var(--skeleton-base) 65%,
    var(--skeleton-base) 100%
  );
  background-size: 220% 100%;
}

@keyframes skeletonShimmer {
  0% {
    background-position: 110% 0;
  }
  100% {
    background-position: -110% 0;
  }
}
</style>
