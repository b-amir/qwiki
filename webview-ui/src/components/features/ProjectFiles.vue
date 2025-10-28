<script setup lang="ts">
import { useWikiStore } from "@/stores/wiki";

const wiki = useWikiStore();
</script>

<template>
  <section class="space-y-2">
    <h3 class="text-sm font-semibold tracking-wide">Project</h3>
    <div v-if="wiki.overview" class="text-muted-foreground text-xs">
      {{ wiki.overview }}
    </div>
    <ul class="divide-border max-h-64 divide-y overflow-auto rounded border">
      <li
        v-for="p in wiki.filesSample"
        :key="p"
        class="hover:bg-accent/50 cursor-pointer truncate px-3 py-2 text-sm"
        @click="wiki.openFile(p)"
      >
        {{ p }}
      </li>
    </ul>
  </section>
</template>
