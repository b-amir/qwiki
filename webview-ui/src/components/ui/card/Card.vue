<script setup lang="ts">
import { cn } from "@/lib/utils";
defineProps<{ class?: string }>();
</script>

<template>
  <div :class="cn('bg-card text-card-foreground rounded-lg border shadow-sm', $props.class)">
    <slot />
  </div>
</template>
