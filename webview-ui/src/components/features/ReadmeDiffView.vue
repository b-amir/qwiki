<script setup lang="ts">
import { computed } from "vue";
import { computeLineDiff, type DiffLine } from "@/utilities/diff";

interface Props {
  original: string;
  updated: string;
}

const props = defineProps<Props>();

const diffLines = computed(() => computeLineDiff(props.original, props.updated));

const getLineClass = (type: DiffLine["type"], side: "original" | "updated") => {
  if (side === "original") {
    if (type === "removed" || type === "modified") {
      return "bg-red-500/10 border-l-2 border-red-500";
    }
    return "";
  } else {
    if (type === "added" || type === "modified") {
      return "bg-green-500/10 border-l-2 border-green-500";
    }
    return "";
  }
};

const getLineTextClass = (type: DiffLine["type"]) => {
  if (type === "removed") {
    return "text-red-600 line-through";
  }
  if (type === "added") {
    return "text-green-600";
  }
  if (type === "modified") {
    return "text-yellow-600";
  }
  return "";
};
</script>

<template>
  <div class="flex h-full gap-4">
    <div class="flex-1 overflow-y-auto">
      <div class="text-muted-foreground mb-2 text-xs font-medium">Current README</div>
      <div class="border-border bg-background max-h-[60vh] overflow-y-auto rounded-lg border">
        <div class="font-mono text-sm">
          <div
            v-for="(line, index) in diffLines"
            :key="`original-${index}`"
            :class="[
              'px-3 py-1',
              getLineClass(line.type, 'original'),
              line.type !== 'unchanged' ? 'font-medium' : '',
            ]"
          >
            <span v-if="line.originalLine !== undefined" :class="getLineTextClass(line.type)">
              {{ line.originalLine || " " }}
            </span>
          </div>
        </div>
      </div>
    </div>
    <div class="flex-1 overflow-y-auto">
      <div class="text-muted-foreground mb-2 text-xs font-medium">Updated README</div>
      <div class="border-border bg-background max-h-[60vh] overflow-y-auto rounded-lg border">
        <div class="font-mono text-sm">
          <div
            v-for="(line, index) in diffLines"
            :key="`updated-${index}`"
            :class="[
              'px-3 py-1',
              getLineClass(line.type, 'updated'),
              line.type !== 'unchanged' ? 'font-medium' : '',
            ]"
          >
            <span v-if="line.updatedLine !== undefined" :class="getLineTextClass(line.type)">
              {{ line.updatedLine || " " }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
