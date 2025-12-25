<script setup lang="ts">
interface AggregationConfig {
  includeSummaries: boolean;
  mergeStrategy: "sequential" | "categorical" | "chronological" | "alphabetical" | "custom";
  outputFormat: "markdown" | "html" | "json";
  title?: string;
}

interface Props {
  config: AggregationConfig;
  selectedCount: number;
  creating: boolean;
  previewing: boolean;
}

interface Emits {
  (e: "update:config", value: AggregationConfig): void;
  (e: "create"): void;
  (e: "preview"): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const updateConfig = (updates: Partial<AggregationConfig>) => {
  emit("update:config", { ...props.config, ...updates });
};

const create = () => {
  emit("create");
};

const preview = () => {
  emit("preview");
};
</script>

<template>
  <div class="border-border flex-shrink-0 border-b p-4">
    <h2 class="mb-4 text-sm font-semibold">Configuration</h2>
    <div class="space-y-4">
      <div>
        <label class="text-muted-foreground mb-1 block text-sm">Title (optional)</label>
        <input
          :value="config.title"
          type="text"
          placeholder="Aggregation title..."
          class="border-input bg-muted text-foreground placeholder:text-muted-foreground focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
          @input="updateConfig({ title: ($event.target as HTMLInputElement).value })"
        />
      </div>
      <div>
        <label class="text-muted-foreground mb-1 block text-sm">Merge Strategy</label>
        <select
          :value="config.mergeStrategy"
          class="border-input bg-muted text-foreground focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
          @change="
            updateConfig({ mergeStrategy: ($event.target as HTMLSelectElement).value as AggregationConfig['mergeStrategy'] })
          "
        >
          <option value="sequential">Sequential</option>
          <option value="categorical">Categorical</option>
          <option value="chronological">Chronological</option>
          <option value="alphabetical">Alphabetical</option>
          <option value="custom">Custom</option>
        </select>
      </div>
      <div>
        <label class="text-muted-foreground mb-1 block text-sm">Output Format</label>
        <select
          :value="config.outputFormat"
          class="border-input bg-muted text-foreground focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
          @change="
            updateConfig({ outputFormat: ($event.target as HTMLSelectElement).value as AggregationConfig['outputFormat'] })
          "
        >
          <option value="markdown">Markdown</option>
          <option value="html">HTML</option>
          <option value="json">JSON</option>
        </select>
      </div>
      <div>
        <label class="flex cursor-pointer items-center gap-2">
          <input
            :checked="config.includeSummaries"
            type="checkbox"
            class="rounded"
            @change="
              updateConfig({ includeSummaries: ($event.target as HTMLInputElement).checked })
            "
          />
          <span class="text-sm">Include Summaries</span>
        </label>
      </div>
      <div class="flex gap-2">
        <button
          :disabled="selectedCount === 0 || previewing || creating"
          class="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
          @click="preview"
        >
          {{ previewing ? "Previewing..." : "Preview" }}
        </button>
        <button
          :disabled="selectedCount === 0 || creating || previewing"
          class="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
          @click="create"
        >
          {{ creating ? "Creating..." : "Create Aggregation" }}
        </button>
      </div>
    </div>
  </div>
</template>
