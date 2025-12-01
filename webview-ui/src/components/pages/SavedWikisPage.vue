<script setup lang="ts">
import LoadingState from "@/components/features/LoadingState.vue";
import WikiPreviewModal from "@/components/features/WikiPreviewModal.vue";
import WikiListItem from "@/components/features/WikiListItem.vue";
import SearchInput from "@/components/ui/SearchInput.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import ReadmeActionsBar from "./saved-wikis/ReadmeActionsBar.vue";
import ReadmeStatusOverlay from "./saved-wikis/ReadmeStatusOverlay.vue";
import { useSavedWikisPage } from "./saved-wikis/useSavedWikisPage";

const {
  searchQuery,
  debouncedSearchQuery,
  filteredWikis,
  groupedWikis,
  virtualListItems,
  virtualList,
  containerProps,
  wrapperProps,
  previewWiki,
  updateReadmeState,
  undoReadmeState,
  hasBackup,
  isReadmeSynced,
  diffAvailable,
  isSavedWikisLoading,
  isReadmeUpdateLoading,
  readmeUpdateLoadingContext,
  scrollableContainer,
  updateReadme,
  undoReadme,
  showReadmeDiff,
  showPreview,
  deleteWiki,
  openWiki,
  loadSavedWikis,
  preventScroll,
} = useSavedWikisPage();
</script>

<template>
  <div class="flex h-full min-w-0 flex-col overflow-hidden">
    <div class="border-border flex-shrink-0 border-b px-3 py-3 sm:px-4 sm:py-4">
      <SearchInput v-model="searchQuery" placeholder="Search wikis..." />
    </div>

    <div class="flex min-w-0 flex-1 flex-col overflow-hidden">
      <div v-if="isSavedWikisLoading" class="flex h-full w-full">
        <LoadingState context="savedWikis" />
      </div>

      <EmptyState
        v-else-if="filteredWikis.length === 0"
        :title="debouncedSearchQuery ? 'No wikis found' : 'No saved wikis yet'"
        :description="
          debouncedSearchQuery
            ? 'Try a different search term.'
            : 'Generate and save some wikis to see them here.'
        "
        :show-action="!debouncedSearchQuery"
        action-text="Refresh"
        @action="loadSavedWikis"
      />

      <div
        v-else
        ref="scrollableContainer"
        :class="[
          'relative flex min-h-0 flex-1 flex-col',
          isReadmeUpdateLoading ? 'overflow-hidden' : '',
        ]"
        @wheel="preventScroll"
        @touchmove="preventScroll"
      >
        <div
          v-if="filteredWikis.length > 50"
          v-bind="containerProps"
          :class="[
            'relative flex min-h-0 flex-1 flex-col',
            isReadmeUpdateLoading ? 'overflow-hidden' : 'overflow-y-auto',
          ]"
        >
          <div v-bind="wrapperProps">
            <div
              v-for="{ data: item, index } in virtualList"
              :key="item.id"
              :style="{ height: item.type === 'header' ? '32px' : '80px' }"
            >
              <div
                v-if="item.type === 'header'"
                class="bg-muted/90 text-muted-foreground border-border sticky top-0 z-10 min-w-0 border-b px-3 py-2 text-xs font-medium uppercase tracking-wider backdrop-blur-sm sm:px-4"
              >
                {{ item.date }}
              </div>
              <WikiListItem
                v-else-if="item.wiki"
                v-memo="[item.wiki.id, item.wiki.title, item.wiki.tags.length]"
                :wiki="item.wiki"
                :selected="false"
                @preview="showPreview"
                @delete="deleteWiki"
                @open="openWiki"
              />
            </div>
          </div>
        </div>
        <div
          v-else
          :class="[
            'relative flex min-h-0 flex-1 flex-col',
            isReadmeUpdateLoading ? 'overflow-hidden' : 'overflow-y-auto',
          ]"
        >
          <div
            v-for="(wikis, date) in groupedWikis"
            :key="date"
            class="border-border min-w-0 border-b last:border-b-0"
          >
            <div
              class="bg-muted/90 text-muted-foreground border-border sticky top-0 z-10 min-w-0 border-b px-3 py-2 text-xs font-medium uppercase tracking-wider backdrop-blur-sm sm:px-4"
            >
              {{ date }}
            </div>
            <div class="divide-border divide-y">
              <WikiListItem
                v-for="wiki in wikis"
                :key="wiki.id"
                v-memo="[wiki.id, wiki.title, wiki.tags.length]"
                :wiki="wiki"
                :selected="false"
                @preview="showPreview"
                @delete="deleteWiki"
                @open="openWiki"
              />
            </div>
          </div>
        </div>
        <ReadmeStatusOverlay
          :is-loading="isReadmeUpdateLoading"
          :steps="readmeUpdateLoadingContext.steps.value"
          :current-step="readmeUpdateLoadingContext.state.value.step || 'analyzingWikis'"
        />
      </div>
    </div>

    <ReadmeActionsBar
      v-if="filteredWikis.length > 0"
      :has-backup="hasBackup"
      :update-state="updateReadmeState"
      :undo-state="undoReadmeState"
      :is-synced="isReadmeSynced"
      :diff-available="diffAvailable"
      @update="updateReadme"
      @undo="undoReadme"
      @showDiff="showReadmeDiff"
    />

    <WikiPreviewModal :wiki="previewWiki" @close="previewWiki = null" />
  </div>
</template>
