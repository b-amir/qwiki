<script setup lang="ts">
import { computed, ref } from "vue";
import { useNavigation } from "@/composables/useNavigation";
import { useErrorCategory } from "@/composables/useErrorCategory";
import Modal from "@/components/ui/Modal.vue";
import ModalHeader from "@/components/ui/ModalHeader.vue";
import ModalContent from "@/components/ui/ModalContent.vue";
import ModalFooter from "@/components/ui/ModalFooter.vue";

interface Props {
  error: string;
  errorCode?: string;
  suggestions?: string[];
  retryable?: boolean;
  onRetry?: () => void;
  timestamp?: string;
  context?: string;
  originalError?: string;
  modelValue?: boolean;
}

interface Emits {
  (e: "update:modelValue", value: boolean): void;
  (e: "close"): void;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: true,
});

const emit = defineEmits<Emits>();
const { setPage } = useNavigation();

const { category: errorCategory } = useErrorCategory(props.errorCode);

const detailsExpanded = ref(false);

const isOpen = computed({
  get: () => props.modelValue !== false,
  set: (value) => {
    emit("update:modelValue", value);
    if (!value) {
      emit("close");
    }
  },
});

const handleClose = () => {
  isOpen.value = false;
};

const hasDuplicateDetails = computed(() => {
  if (!props.context || !props.originalError) return false;
  try {
    const contextObj = JSON.parse(props.context);
    const originalObj = JSON.parse(props.originalError);
    return JSON.stringify(contextObj) === JSON.stringify(originalObj);
  } catch {
    return props.context === props.originalError;
  }
});

const errorDetails = computed(() => {
  if (!props.context && !props.originalError) return null;

  if (hasDuplicateDetails.value) {
    return props.context || props.originalError;
  }

  const parts: string[] = [];
  if (props.context) parts.push(props.context);
  if (props.originalError && props.originalError !== props.error) {
    parts.push(props.originalError);
  }

  return parts.length > 0 ? parts.join("\n\n") : null;
});
</script>

<template>
  <Modal v-model="isOpen" max-width="max-w-2xl">
    <template #default="{ close }">
      <ModalHeader @close="handleClose">
        <div class="min-w-0 flex-1">
          <h2 class="text-base font-semibold capitalize sm:text-lg">
            {{ errorCategory.replace("-", " ") }} Error
          </h2>
          <div v-if="errorCode" class="text-muted-foreground mt-1 text-xs">
            <span class="font-mono">{{ errorCode }}</span>
          </div>
        </div>
      </ModalHeader>

      <ModalContent>
        <div class="space-y-4">
          <div>
            <p class="text-foreground whitespace-pre-wrap break-words text-sm leading-relaxed">
              {{ error }}
            </p>
          </div>

          <div v-if="suggestions && suggestions.length > 0" class="space-y-2">
            <h4 class="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Suggestions
            </h4>
            <ul class="space-y-1.5">
              <li
                v-for="(suggestion, index) in suggestions"
                :key="index"
                class="text-muted-foreground text-sm leading-relaxed"
              >
                • {{ suggestion }}
              </li>
            </ul>
          </div>

          <div v-if="errorDetails" class="space-y-2">
            <button
              class="text-muted-foreground hover:text-foreground flex w-full items-center justify-between text-xs font-medium uppercase tracking-wide transition-colors"
              @click="detailsExpanded = !detailsExpanded"
            >
              <span>Details</span>
              <svg
                class="h-4 w-4 transition-transform"
                :class="{ 'rotate-180': detailsExpanded }"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
            <div
              class="overflow-hidden transition-all duration-300 ease-in-out"
              :class="detailsExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'"
            >
              <div class="bg-muted/30 break-words rounded p-2.5 font-mono text-xs leading-relaxed">
                {{ errorDetails }}
              </div>
            </div>
          </div>
        </div>
      </ModalContent>

      <ModalFooter>
        <div class="flex w-full justify-center gap-2">
          <button
            v-if="retryable && onRetry"
            class="bg-primary hover:bg-primary/90 text-primary-foreground rounded px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm"
            @click="onRetry"
          >
            Retry
          </button>
          <button
            class="text-muted-foreground hover:text-foreground rounded px-3 py-1.5 text-xs transition-colors sm:text-sm"
            @click="setPage('settings')"
          >
            Change model
          </button>
        </div>
      </ModalFooter>
    </template>
  </Modal>
</template>
