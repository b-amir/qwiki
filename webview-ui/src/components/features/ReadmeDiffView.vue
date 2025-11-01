<script setup lang="ts">
interface Props {
  original: string;
  updated: string;
}

defineProps<Props>();
</script>

<template>
  <div class="flex h-full gap-4">
    <div class="flex-1 overflow-y-auto">
      <div class="text-muted-foreground mb-2 text-xs font-medium">Current README</div>
      <div class="prose prose-sm max-w-none rounded-lg border border-border bg-background p-4">
        <pre class="whitespace-pre-wrap text-sm">{{ original }}</pre>
      </div>
    </div>
    <div class="flex-1 overflow-y-auto">
      <div class="text-muted-foreground mb-2 text-xs font-medium">Updated README</div>
      <div class="prose prose-sm max-w-none rounded-lg border border-border bg-background p-4">
        <pre class="whitespace-pre-wrap text-sm">{{ updated }}</pre>
      </div>
    </div>
  </div>
</template>

