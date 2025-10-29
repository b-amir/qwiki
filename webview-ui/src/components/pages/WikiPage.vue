<script setup lang="ts">
import { computed } from "vue";
import LoadingState from "@/components/features/LoadingState.vue";
import ErrorDisplay from "@/components/features/ErrorDisplay.vue";
import MarkdownRenderer from "@/components/MarkdownRenderer.vue";
import RelatedFiles from "@/components/features/RelatedFiles.vue";
import ProjectFiles from "@/components/features/ProjectFiles.vue";
import { useWikiStore } from "@/stores/wiki";
import { useNavigation } from "@/composables/useNavigation";

const wiki = useWikiStore();
const { setPage } = useNavigation();

const wikiContentWithoutTitle = computed(() => {
  if (wiki.content && typeof wiki.content === "string") {
    return wiki.content.replace(/^#\s+.+$/m, "");
  }
  return wiki.content || "";
});
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="flex-1 overflow-auto pb-3">
      <div v-if="wiki.loading" class="h-full">
        <LoadingState
          :steps="[
            { text: 'Validating selection...', key: 'validating' },
            { text: 'Analyzing code structure...', key: 'analyzing' },
            { text: 'Finding related files...', key: 'finding' },
            { text: 'Preparing LLM request...', key: 'preparing' },
            { text: 'Building documentation prompt...', key: 'buildingPrompt' },
            { text: 'Sending request to LLM...', key: 'sendingRequest' },
            { text: 'Waiting for LLM response...', key: 'waitingForResponse' },
            { text: 'Processing response...', key: 'processing' },
            { text: 'Finalizing documentation...', key: 'finalizing' },
          ]"
          :current-step="wiki.loadingStep"
          density="medium"
        />
      </div>
      <ErrorDisplay
        v-else-if="wiki.error"
        :error="wiki.error"
        :error-code="wiki.errorInfo?.code"
        :suggestions="wiki.errorInfo?.suggestions"
        :retryable="wiki.errorInfo?.retryable"
        :on-retry="wiki.retryGeneration"
      >
        <template #actions>
          <div class="flex justify-center gap-4 pt-6">
            <button
              class="text-muted-foreground hover:text-muted-foreground/80 text-sm"
              @click="setPage('settings')"
            >
              Change model
            </button>
            <button
              v-if="wiki.errorInfo?.retryable"
              class="text-primary hover:text-primary/80 text-sm"
              @click="wiki.retryGeneration"
            >
              Retry
            </button>
          </div>
        </template>
      </ErrorDisplay>
      <div v-else-if="wiki.content" class="px-2 pl-3">
        <MarkdownRenderer :content="wikiContentWithoutTitle" />
      </div>

      <div
        v-if="wiki.related.length || wiki.filesSample.length"
        class="border-border grid gap-4 border-t pt-4 md:grid-cols-2"
      >
        <RelatedFiles />
        <ProjectFiles />
      </div>
    </div>
  </div>
</template>
