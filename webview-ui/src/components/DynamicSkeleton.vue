<template>
  <div ref="wrapperEl" class="step-wrapper">
    <div ref="viewportEl" class="viewport">
      <div class="step-track" :style="trackStyle">
        <div
          v-for="(item, index) in visibleStepStates"
          :key="item.step.key"
          ref="rowRefs"
          :class="[
            'step-row',
            item.state,
            { center: index === activeLocalIndex },
            item.completedDepth ? `depth-${item.completedDepth}` : '',
          ]"
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
                'step-text transition-colors',
                item.state === 'completed'
                  ? 'text-muted-foreground completed-text'
                  : 'text-foreground active-text',
              ]"
            >
              {{ item.step.text }}
            </span>
            <div v-else class="skeleton-line" :style="item.skeletonStyle"></div>
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

const fallbackSteps: LoadingStep[] = [
  { text: "Loading...", key: "loading" },
  { text: "Preparing...", key: "preparing" },
  { text: "Finalizing...", key: "finalizing" },
];

const steps = computed(() => (props.steps && props.steps.length ? props.steps : fallbackSteps));

const activeIndex = computed(() => {
  if (!props.currentStep) return 0;
  const index = steps.value.findIndex((step) => step.key === props.currentStep);
  return index === -1 ? 0 : index;
});

const stepStates = computed(() => {
  return steps.value.map((step, index) => {
    let state: StepState = "pending";
    if (index < activeIndex.value) state = "completed";
    else if (index === activeIndex.value) state = props.currentStep ? "active" : "pending";

    const distanceFromActive = activeIndex.value - index; // positive for completed above
    const completedDepth =
      state === "completed" && distanceFromActive >= 1 && distanceFromActive <= 3
        ? distanceFromActive
        : 0;

    return {
      step,
      state,
      completedDepth,
      skeletonStyle: generateSkeletonStyle(step.text),
    } as {
      step: LoadingStep;
      state: StepState;
      completedDepth: number;
      skeletonStyle: Record<string, string>;
    };
  });
});

const visibleStart = computed(() => Math.max(0, activeIndex.value - 3));
const visibleEnd = computed(() => Math.min(steps.value.length - 1, activeIndex.value + 3));
const visibleStepStates = computed(() =>
  stepStates.value.slice(visibleStart.value, visibleEnd.value + 1),
);
const activeLocalIndex = computed(() => activeIndex.value - visibleStart.value);

function generateSkeletonStyle(text: string) {
  const trimmedLength = Math.max(4, text.replace(/\s+/g, " ").trim().length);
  const offsetForPadding = 4;
  const minChars = 12;
  const maxChars = 68;
  const estimatedChars = Math.round(trimmedLength * 0.9) + offsetForPadding;
  const clamped = Math.min(maxChars, Math.max(minChars, estimatedChars));

  return {
    "--skeleton-ch": `${clamped}`,
  } as Record<string, string>;
}

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
  const idx = activeLocalIndex.value;
  const center = viewportHeight.value / 2;
  const activeCenter = (idx + 0.5) * h + idx * rowGap;
  return center - activeCenter;
});

const trackStyle = computed(() => {
  return {
    transform: `translate3d(0, ${offsetY.value}px, 0)`,
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
  transition:
    gap 180ms ease,
    opacity 180ms ease;
}

.step-row.completed {
  gap: 6px;
  opacity: 0.85;
}

.step-row.completed.depth-1 {
  opacity: 0.85;
  filter: blur(0.2px);
}
.step-row.completed.depth-2 {
  opacity: 0.7;
  filter: blur(0.5px);
}
.step-row.completed.depth-3 {
  opacity: 0.55;
  filter: blur(0.8px);
}

.step-row.active {
  gap: 10px;
}

.step-row.pending {
  gap: 8px;
}

.skeleton-line {
  height: 1.25rem;
  border-radius: 6px;
  width: min(calc(var(--skeleton-ch) * 1ch), 100%);
  --skeleton-base: color-mix(in oklab, var(--vscode-widget-border, var(--border)) 80%, transparent);
  --skeleton-highlight: color-mix(
    in oklab,
    var(--primary, var(--vscode-textLink-foreground)) 22%,
    transparent
  );
  background-image: linear-gradient(
    90deg,
    var(--skeleton-base) 0%,
    var(--skeleton-base) 35%,
    var(--skeleton-highlight) 50%,
    var(--skeleton-base) 65%,
    var(--skeleton-base) 100%
  );
  background-size: 220% 100%;
  animation: skeletonShimmer 0.9s cubic-bezier(0.2, 0.6, 0.35, 1) infinite;
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
  animation: iconPulse 1.2s ease-in-out infinite;
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

.step-text {
  display: inline-flex;
  align-items: center;
  line-height: 1.25rem;
}

.completed-text {
  font-size: 0.75rem;
  letter-spacing: -0.005em;
  font-weight: 500;
}

.active-text {
  font-size: 0.875rem;
  font-weight: 600;
  animation: textPulse 1.4s ease-in-out infinite;
}

/* Left-to-right snappy shimmer */
@keyframes skeletonShimmer {
  0% {
    background-position: -110% 0;
  }
  100% {
    background-position: 110% 0;
  }
}

@keyframes iconPulse {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.08);
  }
  100% {
    transform: scale(1);
  }
}

@keyframes textPulse {
  0% {
    opacity: 0.9;
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 0.9;
  }
}
</style>
