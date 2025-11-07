<script setup lang="ts">
import { computed, ref } from "vue";
import ReadmeDiffView from "./ReadmeDiffView.vue";
import type { ReadmePreview, SectionChange } from "../../../../src/domain/entities/ReadmeUpdate";

interface ChangeSummary {
  added: number;
  updated: number;
  removed: number;
  preserved: number;
}

interface Props {
  preview: ReadmePreview | null;
  changeSummary: ChangeSummary | null;
  backupOriginal: boolean;
  warnings?: string[];
}

interface Emits {
  (e: "confirm"): void;
  (e: "cancel"): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

type ViewMode = "full" | "section";
const viewMode = ref<ViewMode>("full");
const selectedSection = ref<string | null>(null);

const showDiff = computed(() => !!props.preview);

const sections = computed(() => {
  if (!props.preview) return [];
  return props.preview.changes;
});

const selectedSectionData = computed(() => {
  if (!selectedSection.value || !props.preview) return null;
  return sections.value.find((s) => s.section === selectedSection.value);
});

const extractSectionFromContent = (content: string, sectionName: string): string => {
  const lines = content.split("\n");
  const normalizedName = sectionName.toLowerCase();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

    if (headingMatch && headingMatch[2].trim().toLowerCase() === normalizedName) {
      const sectionStart = i;
      const nextSectionStart = lines.findIndex(
        (line, index) => index > sectionStart && line.match(/^#{1,6}\s+/),
      );
      const sectionEnd = nextSectionStart === -1 ? lines.length : nextSectionStart;
      return lines.slice(sectionStart, sectionEnd).join("\n");
    }
  }

  return "";
};

const getSectionOriginalContent = (sectionName: string): string => {
  if (!props.preview) return "";
  const section = sections.value.find((s) => s.section === sectionName);
  if (
    section &&
    (section.action === "removed" || section.action === "updated" || section.action === "preserved")
  ) {
    return extractSectionFromContent(props.preview.original, sectionName);
  }
  return "";
};

const getSectionUpdatedContent = (sectionName: string): string => {
  if (!props.preview) return "";
  const section = sections.value.find((s) => s.section === sectionName);
  if (
    section &&
    (section.action === "added" || section.action === "updated" || section.action === "preserved")
  ) {
    if (section.content) {
      return section.content;
    }
    return extractSectionFromContent(props.preview.updated, sectionName);
  }
  return "";
};

const getActionColor = (action: SectionChange["action"]) => {
  switch (action) {
    case "added":
      return "text-green-600";
    case "updated":
      return "text-yellow-600";
    case "removed":
      return "text-red-600";
    case "preserved":
      return "text-muted-foreground";
  }
};

const getActionIcon = (action: SectionChange["action"]) => {
  switch (action) {
    case "added":
      return "+";
    case "updated":
      return "~";
    case "removed":
      return "-";
    case "preserved":
      return "✓";
  }
};

const selectSection = (sectionName: string) => {
  selectedSection.value = sectionName;
  viewMode.value = "section";
};

const showFullDiff = () => {
  viewMode.value = "full";
  selectedSection.value = null;
};
</script>

<template>
  <div
    class="bg-muted/95 fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md will-change-[opacity,backdrop-filter]"
    @click.self="emit('cancel')"
  >
    <div class="bg-background border-border w-full max-w-4xl rounded-lg border shadow-lg">
      <div class="border-border flex-shrink-0 border-b p-6">
        <h3 class="text-lg font-semibold">Confirm README Update</h3>
        <p v-if="changeSummary" class="text-muted-foreground mt-1 text-sm">
          Review the changes before applying them to your README
        </p>
      </div>

      <div class="max-h-[60vh] overflow-y-auto p-6">
        <div v-if="changeSummary" class="mb-4 space-y-2">
          <div class="text-sm font-medium">Change Summary:</div>
          <div class="grid grid-cols-4 gap-2 text-sm">
            <div v-if="changeSummary.added > 0" class="text-green-600">
              +{{ changeSummary.added }} added
            </div>
            <div v-if="changeSummary.updated > 0" class="text-yellow-600">
              ~{{ changeSummary.updated }} updated
            </div>
            <div v-if="changeSummary.removed > 0" class="text-red-600">
              -{{ changeSummary.removed }} removed
            </div>
            <div v-if="changeSummary.preserved > 0" class="text-muted-foreground">
              ✓{{ changeSummary.preserved }} preserved
            </div>
          </div>

          <div
            v-if="warnings && warnings.length > 0"
            class="rounded-md border border-yellow-500/20 bg-yellow-500/10 p-3 text-sm"
          >
            <div class="font-medium text-yellow-600">Warnings:</div>
            <ul class="mt-1 list-disc space-y-1 pl-5">
              <li v-for="warning in warnings" :key="warning">{{ warning }}</li>
            </ul>
          </div>

          <div v-if="backupOriginal" class="text-muted-foreground text-xs">
            A backup will be created automatically
          </div>
        </div>

        <div v-if="showDiff && preview" class="space-y-4">
          <div class="border-border flex items-center justify-between border-b pb-2">
            <div class="flex gap-2">
              <button
                :class="[
                  'rounded-md px-3 py-1.5 text-sm transition-colors',
                  viewMode === 'full'
                    ? 'bg-primary text-primary-foreground'
                    : 'border-border hover:bg-accent border',
                ]"
                @click="showFullDiff"
              >
                Full Diff
              </button>
              <button
                :class="[
                  'rounded-md px-3 py-1.5 text-sm transition-colors',
                  viewMode === 'section'
                    ? 'bg-primary text-primary-foreground'
                    : 'border-border hover:bg-accent border',
                ]"
                @click="viewMode = 'section'"
              >
                Section Preview
              </button>
            </div>
          </div>

          <div v-if="viewMode === 'full'" class="h-[400px]">
            <ReadmeDiffView :original="preview.original" :updated="preview.updated" />
          </div>

          <div v-else class="space-y-4">
            <div class="border-border rounded-lg border p-4">
              <div class="text-muted-foreground mb-3 text-sm font-medium">Sections:</div>
              <div class="space-y-2">
                <button
                  v-for="section in sections"
                  :key="section.section"
                  :class="[
                    'border-border hover:bg-accent/50 flex w-full items-center justify-between rounded-md border p-3 text-left transition-colors',
                    selectedSection === section.section ? 'bg-accent' : '',
                  ]"
                  @click="selectSection(section.section)"
                >
                  <div class="flex items-center gap-2">
                    <span :class="['font-medium', getActionColor(section.action)]">
                      {{ getActionIcon(section.action) }}
                    </span>
                    <span class="text-sm font-medium">{{ section.section }}</span>
                  </div>
                  <span :class="['text-xs', getActionColor(section.action)]">
                    {{ section.action }}
                  </span>
                </button>
              </div>
            </div>

            <div v-if="selectedSectionData" class="h-[400px]">
              <div class="text-muted-foreground mb-2 text-sm font-medium">
                Preview: {{ selectedSectionData.section }}
              </div>
              <ReadmeDiffView
                :original="getSectionOriginalContent(selectedSectionData.section)"
                :updated="getSectionUpdatedContent(selectedSectionData.section)"
              />
            </div>
            <div
              v-else
              class="text-muted-foreground flex h-[400px] items-center justify-center text-sm"
            >
              Select a section to preview changes
            </div>
          </div>
        </div>
      </div>

      <div class="border-border flex-shrink-0 border-t p-6">
        <div class="flex justify-end gap-2">
          <button
            class="border-border hover:bg-accent rounded-md border px-4 py-2 text-sm transition-colors"
            @click="emit('cancel')"
          >
            Cancel
          </button>
          <button
            class="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium transition-colors"
            @click="emit('confirm')"
          >
            Confirm Update
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
