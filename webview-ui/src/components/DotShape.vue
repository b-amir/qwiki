<template>
  <rect :x="x" :y="y" rx="1" width="10" height="10" :fill="fill" :opacity="opacity" :style="style">
    <slot />
  </rect>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    x?: string | number;
    y?: string | number;
    fill?: string;
    opacity?: string | number;
    style?: Record<string, string>;
  }>(),
  {
    x: "1",
    y: "1",
    fill: "currentColor",
    opacity: undefined,
    style: undefined,
  },
);
</script>
