<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import { useVscode } from "@/composables/useVscode";
import LoadingState from "@/components/features/LoadingState.vue";
import ErrorDisplay from "@/components/features/ErrorDisplay.vue";
import WikiSelectionPanel from "@/components/features/WikiSelectionPanel.vue";
import ReadmeDiffView from "@/components/features/ReadmeDiffView.vue";
import ReadmeSectionConfig from "@/components/features/ReadmeSectionConfig.vue";
import ReadmeConfigPanel from "@/components/features/ReadmeConfigPanel.vue";
import ReadmeConfirmDialog from "@/components/features/ReadmeConfirmDialog.vue";
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

interface ReadmeSection {
  name: string;
  content: string;
  priority: number;
  template?: string;
}

interface ReadmeUpdateConfig {
  sections: string[];
  preserveCustom: boolean;
  backupOriginal: boolean;
}

interface UpdateResult {
  success: boolean;
  changes: string[];
  backupPath?: string;
  conflicts: string[];
}

interface ReadmePreview {
  original: string;
  updated: string;
  changes: Array<{
    section: string;
    action: "added" | "updated" | "removed" | "preserved";
    content: string;
  }>;
  warnings: string[];
}

const vscode = useVscode();
const logger = createLogger("ReadmeUpdatePage");
const savedWikis = ref<SavedWiki[]>([]);
const selectedWikis = ref<Set<string>>(new Set());
const currentReadme = ref("");
const loading = ref(true);
const error = ref<string | null>(null);
const updating = ref(false);
const previewing = ref(false);
const showingDiff = ref(false);
const searchQuery = ref("");
const preview = ref<ReadmePreview | null>(null);
const sections = ref<ReadmeSection[]>([]);
const enabledSections = ref<Set<string>>(new Set());
const updateResult = ref<UpdateResult | null>(null);
const showConfirmDialog = ref(false);

const readmeLoadingContext = useLoading("readme");
const isReadmeLoading = computed(
  () => loading.value || readmeLoadingContext.isActive.value || updating.value || previewing.value,
);

const config = ref<ReadmeUpdateConfig>({
  sections: [],
  preserveCustom: true,
  backupOriginal: true,
});

const changeSummary = computed(() => {
  if (!preview.value) return null;
  return {
    added: preview.value.changes.filter((c) => c.action === "added").length,
    updated: preview.value.changes.filter((c) => c.action === "updated").length,
    removed: preview.value.changes.filter((c) => c.action === "removed").length,
    preserved: preview.value.changes.filter((c) => c.action === "preserved").length,
    warnings: preview.value.warnings.length,
  };
});

const loadCurrentReadme = async () => {
  try {
    loading.value = true;
    error.value = null;
    readmeLoadingContext.start("loading");
    vscode.postMessage({ command: "getCurrentReadme" });
  } catch (err) {
    logger.error("Failed to load README", err);
    error.value = "Failed to load README";
    loading.value = false;
    readmeLoadingContext.fail("Failed to load README");
  }
};

const loadSavedWikis = async () => {
  try {
    vscode.postMessage({ command: "getSavedWikis" });
  } catch (err) {
    logger.error("Failed to load saved wikis", err);
  }
};

const generatePreview = async () => {
  if (selectedWikis.value.size === 0) {
    error.value = "Please select at least one wiki";
    return;
  }

  try {
    previewing.value = true;
    error.value = null;
    showingDiff.value = true;
    const payload = {
      wikiIds: Array.from(selectedWikis.value),
      config: {
        sections: Array.from(enabledSections.value),
        preserveCustom: config.value.preserveCustom,
        backupOriginal: config.value.backupOriginal,
      },
    };
    vscode.postMessage({ command: "previewReadmeUpdate", payload });
  } catch (err) {
    logger.error("Failed to generate preview", err);
    error.value = "Failed to generate preview";
    previewing.value = false;
  }
};

const updateReadme = async () => {
  if (selectedWikis.value.size === 0) {
    error.value = "Please select at least one wiki";
    return;
  }

  try {
    updating.value = true;
    error.value = null;
    showConfirmDialog.value = false;
    const payload = {
      wikiIds: Array.from(selectedWikis.value),
      config: {
        sections: Array.from(enabledSections.value),
        preserveCustom: config.value.preserveCustom,
        backupOriginal: config.value.backupOriginal,
      },
    };
    vscode.postMessage({ command: "updateReadme", payload });
  } catch (err) {
    logger.error("Failed to update README", err);
    error.value = "Failed to update README";
    updating.value = false;
  }
};

const validateUpdate = () => {
  if (selectedWikis.value.size === 0) {
    error.value = "Please select at least one wiki";
    return false;
  }
  if (enabledSections.value.size === 0) {
    error.value = "Please select at least one section";
    return false;
  }
  error.value = null;
  return true;
};

const handleConfirmUpdate = () => {
  if (validateUpdate()) {
    showConfirmDialog.value = true;
  }
};

const handleMessage = (event: MessageEvent) => {
  const message = event.data;

  switch (message.command) {
    case "currentReadmeLoaded":
      currentReadme.value = message.payload.content || "";
      sections.value = message.payload.sections || [];
      enabledSections.value = new Set(sections.value.map((s: ReadmeSection) => s.name));
      loading.value = false;
      readmeLoadingContext.complete();
      break;
    case "savedWikisLoaded":
      savedWikis.value = message.payload.wikis || [];
      break;
    case "readmePreviewGenerated":
      preview.value = message.payload.preview;
      previewing.value = false;
      showingDiff.value = true;
      break;
    case "readmeUpdated":
      updateResult.value = message.payload.result;
      updating.value = false;
      if (updateResult.value?.success) {
        loadCurrentReadme();
      }
      break;
    case "readmeBackedUp":
      logger.info("README backed up", message.payload.backupPath);
      break;
    case "readmeRestored":
      loadCurrentReadme();
      break;
    case "showNotification":
      if (message.payload.type === "error") {
        error.value = message.payload.message;
        updating.value = false;
        previewing.value = false;
        readmeLoadingContext.fail(message.payload.message);
      }
      break;
  }
};

onMounted(() => {
  window.addEventListener("message", handleMessage);
  loadCurrentReadme();
  loadSavedWikis();
});

onBeforeUnmount(() => {
  window.removeEventListener("message", handleMessage);
});
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="border-border flex-shrink-0 border-b px-4 py-4">
      <div class="flex items-center justify-between gap-3">
        <h1 class="text-lg font-semibold">Update README</h1>
        <button
          class="text-muted-foreground hover:text-muted-foreground/80 text-sm"
          @click="loadCurrentReadme"
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
        <div v-if="isReadmeLoading && !currentReadme" class="flex h-full w-full">
          <LoadingState context="readme" />
        </div>

        <div
          v-else-if="error && !currentReadme"
          class="flex h-full w-full items-center justify-center px-4"
        >
          <ErrorDisplay :error="error" />
        </div>

        <div v-else class="flex flex-1 overflow-hidden">
          <div class="border-border flex w-80 flex-col border-r">
            <ReadmeConfigPanel
              :config="config"
              :selected-count="selectedWikis.size"
              :updating="updating"
              :previewing="previewing"
              :error="error"
              @update:config="config = $event"
              @preview="generatePreview"
              @update="handleConfirmUpdate"
            />
            <div class="flex-1 overflow-y-auto p-4">
              <ReadmeSectionConfig
                v-if="sections.length > 0"
                :sections="sections"
                :enabled-sections="enabledSections"
                @update:enabled-sections="enabledSections = $event"
              />
              <div v-else class="text-muted-foreground text-center text-sm">
                Load README to see sections
              </div>
            </div>
          </div>

          <div class="flex flex-1 flex-col">
            <div v-if="showingDiff && preview" class="flex h-full flex-col">
              <div class="border-border flex-shrink-0 border-b p-4">
                <div class="flex items-center justify-between">
                  <h2 class="text-sm font-semibold">Preview Changes</h2>
                  <div v-if="changeSummary" class="text-muted-foreground flex gap-4 text-xs">
                    <span>+{{ changeSummary.added }}</span>
                    <span>~{{ changeSummary.updated }}</span>
                    <span>-{{ changeSummary.removed }}</span>
                    <span v-if="changeSummary.warnings > 0" class="text-warning">
                      ⚠ {{ changeSummary.warnings }}
                    </span>
                  </div>
                </div>
              </div>
              <div class="flex-1 overflow-y-auto p-4">
                <ReadmeDiffView :original="preview.original" :updated="preview.updated" />
              </div>
            </div>

            <div v-else class="flex h-full flex-col">
              <div class="border-border flex-shrink-0 border-b p-4">
                <h2 class="text-sm font-semibold">Current README</h2>
              </div>
              <div class="flex-1 overflow-y-auto p-4">
                <div
                  class="prose prose-sm border-border bg-background max-w-none rounded-lg border p-4"
                >
                  <pre class="whitespace-pre-wrap text-sm">{{
                    currentReadme || "No README found"
                  }}</pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <ReadmeConfirmDialog
      v-if="showConfirmDialog"
      :change-summary="changeSummary"
      :backup-original="config.backupOriginal"
      @confirm="updateReadme"
      @cancel="showConfirmDialog = false"
    />
  </div>
</template>
