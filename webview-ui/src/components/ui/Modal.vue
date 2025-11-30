<script setup lang="ts">
interface Props {
  modelValue: boolean;
  maxWidth?: string;
  maxHeight?: string;
}

interface Emits {
  (e: "update:modelValue", value: boolean): void;
}

withDefaults(defineProps<Props>(), {
  maxWidth: "max-w-3xl",
  maxHeight: "max-h-[calc(100vh-2rem)]",
});

const emit = defineEmits<Emits>();

const handleClose = () => {
  emit("update:modelValue", false);
};
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-200"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="modelValue"
        class="bg-muted/95 fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md will-change-[opacity,backdrop-filter]"
        @click.self="handleClose"
      >
        <Transition
          enter-active-class="transition-all duration-200"
          enter-from-class="opacity-0 scale-95"
          enter-to-class="opacity-100 scale-100"
          leave-active-class="transition-all duration-200"
          leave-from-class="opacity-100 scale-100"
          leave-to-class="opacity-0 scale-95"
        >
          <div
            v-if="modelValue"
            :class="[
              'bg-background border-border flex w-full min-w-0 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-lg border shadow-lg',
              maxWidth,
              maxHeight,
            ]"
          >
            <slot :close="handleClose" />
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
