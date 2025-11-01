<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import { useVscode } from "@/composables/useVscode";
import LoadingState from "@/components/features/LoadingState.vue";
import ErrorDisplay from "@/components/features/ErrorDisplay.vue";
import WikiSelectionPanel from "@/components/features/WikiSelectionPanel.vue";
import AggregationConfigPanel from "@/components/features/AggregationConfigPanel.vue";
import AggregationListView from "@/components/features/AggregationListView.vue";
import AggregationDetailView from "@/components/features/AggregationDetailView.vue";
import { useLoading } from "@/loading/useLoading";
import { createLogger } from "@/utilities/logging";

interface SavedWiki {
  id: string;
  title: string;
  content: string;
  filePath: string;
  createdAt: Date;
  tags: string[];
}

interface WikiAggregation {
  id: string;
  title: string;
  wikis: SavedWiki[];
  metadata: {
    totalWikis: number;
    totalSize: number;
    languages: string[];
    tags: string[];
  };
  createdAt: Date;
  updatedAt?: Date;
}

interface AggregationConfig {
  includeSummaries: boolean;
  mergeStrategy: "sequential" | "categorical" | "chronological" | "alphabetical" | "custom";
  outputFormat: "markdown" | "html" | "json";
  title?: string;
}

interface ContentConflict {
  wikiId: string;
  wikiTitle: string;
  conflictType: "duplicate" | "contradictory" | "overlapping" | "outdated";
  conflictingContent: string;
  conflictingWikis: string[];
}

const vscode = useVscode();
const logger = createLogger("WikiAggregationPage");
const aggregations = ref<WikiAggregation[]>([]);
const savedWikis = ref<SavedWiki[]>([]);
const selectedWikis = ref<Set<string>>(new Set());
const loading = ref(true);
const error = ref<string | null>(null);
const creating = ref(false);
const previewing = ref(false);
const viewingAggregation = ref<string | null>(null);
const conflicts = ref<ContentConflict[]>([]);
const searchQuery = ref("");

const aggregationLoadingContext = useLoading("aggregations");
const isAggregationsLoading = computed(
  () => loading.value || aggregationLoadingContext.isActive.value || creating.value,
);

const config = ref<AggregationConfig>({
  includeSummaries: true,
  mergeStrategy: "categorical",
  outputFormat: "markdown",
  title: "",
});

const currentAggregation = computed(() => {
  if (!viewingAggregation.value) return null;
  return aggregations.value.find((a) => a.id === viewingAggregation.value);
});

const previewContent = ref("");

const loadAggregations = async () => {
  try {
    loading.value = true;
    error.value = null;
    aggregationLoadingContext.start("loading");
    vscode.postMessage({ command: "getAggregations" });
  } catch (err) {
    logger.error("Failed to load aggregations", err);
    error.value = "Failed to load aggregations";
    loading.value = false;
    aggregationLoadingContext.fail("Failed to load aggregations");
  }
};

const loadSavedWikis = async () => {
  try {
    vscode.postMessage({ command: "getSavedWikis" });
  } catch (err) {
    logger.error("Failed to load saved wikis", err);
  }
};

const createAggregation = async () => {
  if (selectedWikis.value.size === 0) {
    error.value = "Please select at least one wiki";
    return;
  }

  try {
    creating.value = true;
    error.value = null;
    const payload = {
      wikiIds: Array.from(selectedWikis.value),
      config: {
        includeSummaries: config.value.includeSummaries,
        mergeStrategy: config.value.mergeStrategy,
        outputFormat: config.value.outputFormat,
      },
      title: config.value.title || undefined,
    };
    vscode.postMessage({ command: "createAggregation", payload });
  } catch (err) {
    logger.error("Failed to create aggregation", err);
    error.value = "Failed to create aggregation";
    creating.value = false;
  }
};

const previewAggregation = async () => {
  if (selectedWikis.value.size === 0) {
    error.value = "Please select at least one wiki";
    return;
  }

  try {
    previewing.value = true;
    error.value = null;
    const payload = {
      wikiIds: Array.from(selectedWikis.value),
      config: {
        includeSummaries: config.value.includeSummaries,
        mergeStrategy: config.value.mergeStrategy,
        outputFormat: config.value.outputFormat,
      },
    };
    vscode.postMessage({ command: "previewAggregation", payload });
  } catch (err) {
    logger.error("Failed to preview aggregation", err);
    error.value = "Failed to preview aggregation";
    previewing.value = false;
  }
};

const deleteAggregation = async (aggregationId: string, event: Event) => {
  event.stopPropagation();
  try {
    aggregations.value = aggregations.value.filter((a) => a.id !== aggregationId);
    if (viewingAggregation.value === aggregationId) {
      viewingAggregation.value = null;
    }
    vscode.postMessage({ command: "deleteAggregation", payload: { aggregationId } });
  } catch (err) {
    logger.error("Failed to delete aggregation", err);
    error.value = "Failed to delete aggregation";
  }
};

const viewAggregation = (aggregation: WikiAggregation) => {
  viewingAggregation.value = aggregation.id;
};

const handleMessage = (event: MessageEvent) => {
  const message = event.data;

  switch (message.command) {
    case "aggregationsLoaded":
      aggregations.value = message.payload.aggregations || [];
      loading.value = false;
      aggregationLoadingContext.complete();
      break;
    case "aggregationCreated":
      aggregations.value.push(message.payload.aggregation);
      selectedWikis.value.clear();
      config.value.title = "";
      creating.value = false;
      break;
    case "savedWikisLoaded":
      savedWikis.value = message.payload.wikis || [];
      break;
    case "aggregationPreview":
      previewContent.value = message.payload.content;
      previewing.value = false;
      break;
    case "aggregationConflicts":
      conflicts.value = message.payload.conflicts || [];
      break;
    case "aggregationDeleted":
      aggregations.value = aggregations.value.filter((a) => a.id !== message.payload.aggregationId);
      if (viewingAggregation.value === message.payload.aggregationId) {
        viewingAggregation.value = null;
      }
      break;
    case "showNotification":
      if (message.payload.type === "error") {
        error.value = message.payload.message;
        creating.value = false;
        previewing.value = false;
        aggregationLoadingContext.fail(message.payload.message);
      }
      break;
  }
};

onMounted(() => {
  window.addEventListener("message", handleMessage);
  loadAggregations();
  loadSavedWikis();
});

onBeforeUnmount(() => {
  window.removeEventListener("message", handleMessage);
});
</script>

<template>
  <div class="flex h-full flex-col">
    <AggregationDetailView
      v-if="viewingAggregation && currentAggregation"
      :aggregation="currentAggregation"
      @back="viewingAggregation = null"
      @delete="deleteAggregation"
    />

    <div v-else class="flex h-full flex-col">
      <div class="border-border flex-shrink-0 border-b px-4 py-4">
        <div class="flex items-center justify-between gap-3">
          <h1 class="text-lg font-semibold">Wiki Aggregations</h1>
          <button
            class="text-muted-foreground hover:text-muted-foreground/80 text-sm"
            @click="loadAggregations"
          >
            Refresh
          </button>
        </div>
      </div>

      <div class="flex flex-1 overflow-hidden">
        <WikiSelectionPanel
          :wikis="savedWikis"
          :selected-wikis="selectedWikis"
          :search-query="searchQuery"
          @update:selected-wikis="selectedWikis = $event"
          @update:search-query="searchQuery = $event"
        />

        <div class="flex flex-1 flex-col">
          <div v-if="isAggregationsLoading && aggregations.length === 0" class="flex h-full w-full">
            <LoadingState context="aggregations" />
          </div>

          <div
            v-else-if="error && aggregations.length === 0"
            class="flex h-full w-full items-center justify-center px-4"
          >
            <ErrorDisplay :error="error" />
          </div>

          <div v-else class="flex flex-1 flex-col overflow-hidden">
            <AggregationConfigPanel
              :config="config"
              :selected-count="selectedWikis.size"
              :creating="creating"
              :previewing="previewing"
              @update:config="config = $event"
              @create="createAggregation"
              @preview="previewAggregation"
            />

            <div v-if="error" class="border-border border-b px-4 py-2">
              <div class="text-destructive text-sm">{{ error }}</div>
            </div>

            <div v-if="previewContent" class="flex-1 overflow-y-auto p-4">
              <h3 class="mb-4 text-sm font-semibold">Preview</h3>
              <div
                class="prose prose-sm border-border bg-background max-w-none rounded-lg border p-4"
              >
                <pre class="whitespace-pre-wrap text-sm">{{ previewContent }}</pre>
              </div>
            </div>

            <div v-else-if="conflicts.length > 0" class="flex-1 overflow-y-auto p-4">
              <h3 class="mb-4 text-sm font-semibold">Resolve Conflicts</h3>
              <div class="space-y-4">
                <div
                  v-for="conflict in conflicts"
                  :key="conflict.wikiId"
                  class="border-border rounded-lg border p-4"
                >
                  <div class="mb-2 font-semibold">{{ conflict.wikiTitle }}</div>
                  <div class="text-muted-foreground mb-2 text-sm">
                    Conflict: {{ conflict.conflictType }}
                  </div>
                  <div class="bg-muted rounded p-2 text-sm">{{ conflict.conflictingContent }}</div>
                </div>
              </div>
            </div>

            <div v-else class="flex-1 overflow-y-auto">
              <AggregationListView
                :aggregations="aggregations"
                @view="viewAggregation"
                @delete="deleteAggregation"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
