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
        class="bg-background/80 fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
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
              'bg-background border-border flex w-full flex-col rounded-lg border shadow-lg',
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
