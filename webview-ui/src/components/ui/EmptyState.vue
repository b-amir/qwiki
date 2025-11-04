<template>
  <div class="flex h-full w-full flex-col items-center justify-center px-4 py-6">
    <div class="text-center">
      <div class="text-foreground mb-2 text-lg font-medium">
        {{ title }}
      </div>
      <div class="text-muted-foreground mb-4 text-sm">
        {{ description }}
      </div>
      <slot>
        <button
          v-if="showAction"
          class="text-muted-foreground hover:text-muted-foreground/80 text-sm"
          @click="$emit('action')"
        >
          {{ actionText }}
        </button>
      </slot>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
  description: string;
  showAction?: boolean;
  actionText?: string;
}>();

defineEmits<{
  (e: "action"): void;
}>();
</script>
