<template>
  <div
    ref="rowRef"
    :class="[
      'step-row',
      state,
      { center: isCenter },
      completedDepth ? `depth-${completedDepth}` : '',
      pendingDepth ? `depth-${pendingDepth}` : '',
    ]"
  >
    <div
      :class="[
        'step-icon',
        {
          active: state === 'active',
          completed: state === 'completed',
          placeholder: state === 'pending',
        },
      ]"
    >
      <template v-if="state === 'active'">
        <StepSpinner />
      </template>
      <template v-else-if="state === 'completed'">
        <StepCheckIcon />
      </template>
      <template v-else>
        <span class="pending-dot" aria-hidden="true"></span>
      </template>
    </div>

    <div class="step-text-container min-w-0 flex-1">
      <span
        v-if="state !== 'pending'"
        :class="[
          'step-text transition-colors',
          state === 'completed'
            ? 'text-muted-foreground completed-text'
            : 'text-foreground active-text',
        ]"
      >
        {{ text }}
      </span>
      <SkeletonLine v-else :style="skeletonStyle" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import StepSpinner from "./StepSpinner.vue";
import StepCheckIcon from "./StepCheckIcon.vue";
import SkeletonLine from "./SkeletonLine.vue";

type StepState = "completed" | "active" | "pending";

defineProps<{
  text: string;
  state: StepState;
  isCenter?: boolean;
  completedDepth?: number;
  pendingDepth?: number;
  skeletonStyle?: Record<string, string>;
}>();

const rowRef = ref<HTMLElement | null>(null);

defineExpose({
  rowRef,
});
</script>

<style scoped>
.step-row {
  display: flex;
  align-items: center;
  gap: clamp(0.375rem, 1vw, 0.5rem);
  min-height: clamp(28px, 8vw, 32px);
  transition:
    gap 180ms ease,
    opacity 180ms ease;
}

.step-row.completed {
  gap: clamp(0.25rem, 0.75vw, 0.375rem);
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
  gap: clamp(0.5rem, 1.25vw, 0.625rem);
}

.step-row.pending {
  gap: clamp(0.375rem, 1vw, 0.5rem);
}

.step-row.pending.depth-1 {
  opacity: 0.85;
  filter: blur(0.2px);
}
.step-row.pending.depth-2 {
  opacity: 0.7;
  filter: blur(0.5px);
}
.step-row.pending.depth-3 {
  opacity: 0.55;
  filter: blur(0.8px);
}

.step-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: clamp(16px, 4vw, 20px);
  height: clamp(16px, 4vw, 20px);
  flex-shrink: 0;
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

.pending-dot {
  width: clamp(6px, 1.5vw, 7px);
  height: clamp(6px, 1.5vw, 7px);
  border-radius: clamp(1px, 0.25vw, 1.5px);
  background: var(--border, var(--vscode-widget-border));
  opacity: 0.4;
  flex-shrink: 0;
}

.step-text-container {
  min-width: 0;
  overflow: hidden;
}

.step-text {
  display: inline-block;
  line-height: clamp(1rem, 3vw, 1.25rem);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
}

.completed-text {
  font-size: clamp(0.6875rem, 2vw, 0.75rem);
  letter-spacing: -0.005em;
  font-weight: 500;
}

.active-text {
  font-size: clamp(0.8125rem, 2.5vw, 0.875rem);
  font-weight: 600;
  animation: textPulse 1.4s ease-in-out infinite;
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
