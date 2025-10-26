<template>
  <div class="flex h-full flex-col">
    <!-- Minimal status indicator -->
    <div class="flex-shrink-0 px-4 py-3">
      <div class="flex items-center justify-start gap-3">
        <div class="flex items-center gap-1">
          <div
            v-for="(dot, index) in 3"
            :key="index"
            class="bg-primary h-1.5 w-1.5 rounded-full transition-all duration-300 ease-in-out"
            :class="{
              'scale-75 opacity-20': currentDot !== index,
              'scale-100 opacity-80': currentDot === index,
            }"
          ></div>
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
          class="skeleton-item"
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
const currentDot = ref(0);
const dotInterval = ref<number | null>(null);

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

// Animate dots with smoother transitions
const animateDots = () => {
  dotInterval.value = setInterval(() => {
    currentDot.value = (currentDot.value + 1) % 3;
  }, 800); // Slower for more elegant feel
};

onMounted(() => {
  skeletonElements.value = generateSkeletonElements();
  animateDots();
});

onBeforeUnmount(() => {
  if (dotInterval.value) {
    clearInterval(dotInterval.value);
  }
});
</script>

<style scoped>
/* Snappy skeleton animation */
@keyframes pulse {
  0%,
  100% {
    opacity: 0.4;
    transform: scaleY(1);
  }
  50% {
    opacity: 0.15;
    transform: scaleY(0.95);
  }
}

.skeleton-item {
  animation: pulse 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94) infinite;
}

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
