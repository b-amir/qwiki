<script setup lang="ts">
import { useWikiStore } from "@/stores/wiki";

const wiki = useWikiStore();
</script>

<template>
  <section class="space-y-2">
    <h3 class="text-sm font-semibold tracking-wide">Related files</h3>
    <ul class="divide-border divide-y rounded border">
      <li
        v-for="item in wiki.related"
        :key="item.path + ':' + (item.line || 0)"
        class="hover:bg-accent/50 cursor-pointer px-3 py-2 text-sm"
        @click="wiki.openFile(item.path, item.line)"
      >
        <div class="truncate font-medium">{{ item.path }}</div>
        <div v-if="item.preview" class="text-muted-foreground truncate text-xs">
          {{ item.preview }}
        </div>
      </li>
    </ul>
  </section>
</template>
