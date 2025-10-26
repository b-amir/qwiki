<template>
  <div class="flex h-full flex-col">
    <!-- Minimal status indicator -->
    <div class="flex-shrink-0 px-4 py-3">
      <div class="flex items-center justify-start gap-3">
        <div class="flex items-center">
          <svg
            fill="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
            class="text-primary h-4 w-4"
          >
            <rect x="1" y="1" rx="1" width="10" height="10">
              <animate
                id="spinner_FFyM"
                begin="0;spinner_HDCY.end"
                attributeName="x"
                dur="0.2s"
                values="1;13"
                fill="freeze"
              />
              <animate
                id="spinner_AIvE"
                begin="spinner_1FwE.end"
                attributeName="y"
                dur="0.2s"
                values="1;13"
                fill="freeze"
              />
              <animate
                id="spinner_wWCL"
                begin="spinner_gH4o.end"
                attributeName="x"
                dur="0.2s"
                values="13;1"
                fill="freeze"
              />
              <animate
                id="spinner_S3Gg"
                begin="spinner_Q0bx.end"
                attributeName="y"
                dur="0.2s"
                values="13;1"
                fill="freeze"
              />
            </rect>
            <rect x="1" y="13" rx="1" width="10" height="10">
              <animate
                id="spinner_1FwE"
                begin="spinner_FFyM.end"
                attributeName="y"
                dur="0.2s"
                values="13;1"
                fill="freeze"
              />
              <animate
                id="spinner_gH4o"
                begin="spinner_AIvE.end"
                attributeName="x"
                dur="0.2s"
                values="1;13"
                fill="freeze"
              />
              <animate
                id="spinner_Q0bx"
                begin="spinner_wWCL.end"
                attributeName="y"
                dur="0.2s"
                values="1;13"
                fill="freeze"
              />
              <animate
                id="spinner_HDCY"
                begin="spinner_S3Gg.end"
                attributeName="x"
                dur="0.2s"
                values="13;1"
                fill="freeze"
              />
            </rect>
          </svg>
        </div>
        <span class="text-muted-foreground text-sm font-medium">{{ displayDescription }}</span>
      </div>
    </div>

    <!-- Refined skeleton content -->
    <div class="flex-1 overflow-hidden px-4 py-4">
      <div class="mx-auto max-w-2xl space-y-3">
        <div
          v-for="(skeleton, index) in skeletonElements"
          :key="index"
          class="animate-pulse"
          :style="{ animationDelay: `${index * 0.05}s` }"
        >
          <!-- Line skeleton -->
          <div
            v-if="skeleton.type === 'line'"
            class="skeleton-line"
            :style="{ width: skeleton.width }"
          ></div>

          <!-- Paragraph skeleton -->
          <div v-else-if="skeleton.type === 'paragraph'" class="skeleton-paragraph">
            <div
              v-for="(line, lineIndex) in skeleton.lines"
              :key="lineIndex"
              class="skeleton-line"
              :style="{ width: line.width }"
            ></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from "vue";

interface SkeletonElement {
  type: "line" | "paragraph";
  width?: string;
  lines?: Array<{ width: string }>;
}

interface LoadingStep {
  text: string;
  key: string;
}

const props = defineProps<{
  steps?: LoadingStep[];
  currentStep?: string;
  density?: "low" | "medium" | "high";
}>();

const defaultSteps: LoadingStep[] = [
  { text: "Validating selection...", key: "validating" },
  { text: "Analyzing code structure...", key: "analyzing" },
  { text: "Finding related files...", key: "finding" },
  { text: "Preparing LLM request...", key: "preparing" },
  { text: "Generating documentation...", key: "generating" },
  { text: "Processing response...", key: "processing" },
  { text: "Finalizing documentation...", key: "finalizing" },
];

const steps = computed(() => props.steps || defaultSteps);

const displayDescription = computed(() => {
  if (props.currentStep) {
    const step = steps.value.find((s) => s.key === props.currentStep);
    return step ? step.text : steps.value[0].text;
  }
  return steps.value[0].text;
});

// Generate wiki-style skeleton layout
const generateSkeletonElements = (): SkeletonElement[] => {
  return [
    // Page title
    { type: "line", width: "45%" },

    // Introduction paragraph
    { type: "line", width: "100%" },
    { type: "line", width: "98%" },
    { type: "line", width: "95%" },

    // First section heading
    { type: "line", width: "35%" },

    // Section content
    { type: "line", width: "100%" },
    { type: "line", width: "97%" },
    { type: "line", width: "92%" },

    // Second section heading
    { type: "line", width: "40%" },

    // Section content
    { type: "line", width: "100%" },
  ];
};

const skeletonElements = ref<SkeletonElement[]>([]);

onMounted(() => {
  skeletonElements.value = generateSkeletonElements();
});
</script>

<style scoped>
.skeleton-line {
  height: 12px;
  background-color: var(
    --vscode-textSeparator-foreground,
    var(--vscode-widget-border, var(--border))
  );
  opacity: 0.3;
  border-radius: 6px;
  margin-bottom: 10px;
}

.skeleton-line:last-child {
  margin-bottom: 0;
}
</style>
