<template>
  <div ref="wrapperEl" class="step-wrapper">
    <div ref="viewportEl" class="viewport">
      <div class="step-track" :style="trackStyle">
        <div
          v-for="(item, index) in stepStates"
          :key="item.step.key"
          ref="rowRefs"
          class="step-row"
          :class="{ center: index === activeIndex }"
        >
          <div
            :class="[
              'step-icon',
              {
                active: item.state === 'active',
                completed: item.state === 'completed',
                placeholder: item.state === 'pending',
              },
            ]"
          >
            <template v-if="item.state === 'active'">
              <svg
                class="spinner h-4 w-4"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
                focusable="false"
              >
                <defs>
                  <linearGradient id="starGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color: #8b5cf6">
                      <animate
                        attributeName="stop-color"
                        values="#8B5CF6;#3B82F6;#8B5CF6"
                        dur="6s"
                        repeatCount="indefinite"
                      />
                    </stop>
                    <stop offset="100%" style="stop-color: #3b82f6">
                      <animate
                        attributeName="stop-color"
                        values="#3B82F6;#8B5CF6;#3B82F6"
                        dur="2s"
                        repeatCount="indefinite"
                      />
                    </stop>
                  </linearGradient>
                </defs>
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
            </template>
            <template v-else-if="item.state === 'completed'">
              <svg class="check-icon h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M20 6L9 17l-5-5"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </template>
            <template v-else>
              <span class="pending-dot" aria-hidden="true"></span>
            </template>
          </div>

          <div class="flex-1">
            <span
              v-if="item.state !== 'pending'"
              :class="[
                'text-sm font-medium transition-colors',
                item.state === 'completed' ? 'text-muted-foreground' : 'text-foreground',
              ]"
            >
              {{ item.step.text }}
            </span>
            <div v-else class="skeleton-line animate-pulse" :style="{ width: item.width }"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch, nextTick } from "vue";

interface LoadingStep {
  text: string;
  key: string;
}

type StepState = "completed" | "active" | "pending";

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
  { text: "Building documentation prompt...", key: "buildingPrompt" },
  { text: "Sending request to LLM...", key: "sendingRequest" },
  { text: "Waiting for LLM response...", key: "waitingForResponse" },
  { text: "Processing response...", key: "processing" },
  { text: "Finalizing documentation...", key: "finalizing" },
];

const steps = computed(() => props.steps || defaultSteps);

const activeIndex = computed(() => {
  if (!props.currentStep) return 0;
  const index = steps.value.findIndex((step) => step.key === props.currentStep);
  return index === -1 ? 0 : index;
});

const widthPatterns: Record<NonNullable<typeof props.density>, string[]> = {
  low: ["35%", "55%", "45%", "60%"],
  medium: ["45%", "85%", "100%", "95%", "60%", "90%", "100%", "92%", "70%", "96%"],
  high: ["60%", "95%", "100%", "88%", "75%", "98%", "100%", "93%", "82%", "96%"],
};

const stepStates = computed(() => {
  return steps.value.map((step, index) => {
    let state: StepState = "pending";

    if (index < activeIndex.value) {
      state = "completed";
    } else if (index === activeIndex.value) {
      state = props.currentStep ? "active" : "pending";
    }

    return {
      step,
      state,
      width: generateWidth(step, index),
    };
  });
});

function generateWidth(step: LoadingStep, index: number): string {
  const density = props.density ?? "medium";
  const pattern = widthPatterns[density] ?? widthPatterns.medium;

  if (step.text.length <= 20) {
    return pattern[(index + 1) % pattern.length];
  }

  if (step.text.length >= 40) {
    return pattern[(index + 3) % pattern.length];
  }

  return pattern[index % pattern.length];
}

// Measurement + centering
const wrapperEl = ref<HTMLElement | null>(null);
const viewportEl = ref<HTMLElement | null>(null);
const rowRefs = ref<HTMLElement[]>([]);
const viewportHeight = ref(0);
const rowHeight = ref(32); // default fallback
const rowGap = 8; // keep in sync with CSS gap

let resizeObserver: ResizeObserver | null = null;

function measure() {
  viewportHeight.value = viewportEl.value?.clientHeight ?? wrapperEl.value?.clientHeight ?? 0;
  const firstRow = rowRefs.value[0];
  if (firstRow) {
    rowHeight.value = firstRow.offsetHeight || rowHeight.value;
  }
}

onMounted(async () => {
  await nextTick();
  measure();
  if (wrapperEl.value && "ResizeObserver" in window) {
    resizeObserver = new ResizeObserver(() => measure());
    resizeObserver.observe(wrapperEl.value);
  }
});

onBeforeUnmount(() => {
  if (resizeObserver && wrapperEl.value) {
    resizeObserver.unobserve(wrapperEl.value);
  }
  resizeObserver = null;
});

watch([steps, activeIndex], async () => {
  await nextTick();
  measure();
});

const offsetY = computed(() => {
  const h = rowHeight.value;
  const idx = activeIndex.value;
  const center = viewportHeight.value / 2;
  const activeCenter = (idx + 0.5) * h + idx * rowGap;
  return center - activeCenter;
});

const trackStyle = computed(() => {
  return {
    transform: `translateY(${offsetY.value}px)`,
  } as Record<string, string>;
});
</script>

<style scoped>
.step-wrapper {
  width: 100%;
  height: 100%;
}

.viewport {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.step-track {
  display: flex;
  flex-direction: column;
  gap: 8px;
  will-change: transform;
  transition: transform 260ms cubic-bezier(0.22, 1, 0.36, 1);
  min-height: 100%;
}

.step-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 32px;
}

.skeleton-line {
  height: 10px;
  background-color: var(
    --vscode-textSeparator-foreground,
    var(--vscode-widget-border, var(--border))
  );
  opacity: 0.3;
  border-radius: 5px;
  margin-bottom: 6px;
}

.skeleton-line:last-child {
  margin-bottom: 0;
}

.step-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  transition: color 0.2s ease;
}

.step-icon.active {
  color: var(--primary, var(--vscode-textLink-foreground));
}

.step-icon.completed {
  color: var(--muted-foreground, var(--vscode-descriptionForeground));
}

.step-icon.placeholder {
  color: transparent;
}

.check-icon {
  color: var(--muted-foreground, var(--vscode-descriptionForeground));
}

.pending-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--border, var(--vscode-widget-border));
  opacity: 0.4;
}

.spinner rect {
  fill: url(#starGradient);
}
</style>
