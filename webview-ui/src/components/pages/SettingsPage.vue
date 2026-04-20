<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch, onBeforeUnmount } from "vue";
import LoadingState from "@/components/features/LoadingState.vue";
import ProviderConfigItem from "@/components/features/ProviderConfigItem.vue";
import { useWikiStore } from "@/stores/wiki";
import { useSettingsStore } from "@/stores/settings";
import { useNavigationStore } from "@/stores/navigation";
import { useErrorStore } from "@/stores/error";
import { useLoading } from "@/loading/useLoading";
import { useDelayedLoadingState } from "@/composables/useDelayedLoadingState";
import { useSettingsMessaging } from "@/composables/useSettingsMessaging";
import { useProviderConfigs } from "@/composables/useProviderConfigs";
import { useSettingsHandlers } from "@/composables/useSettingsHandlers";
import { useSettingsInitialization } from "@/composables/useSettingsInitialization";
import { createSettingsNavigationGuard } from "@/composables/useSettingsNavigationGuard";
import { useNavigation } from "@/composables/useNavigation";
import { createLogger } from "@/utilities/logging";

const wiki = useWikiStore();
const settings = useSettingsStore();
const navigationStore = useNavigationStore();
const errorStore = useErrorStore();
const { setNavigationGuard } = useNavigation();
const logger = createLogger("SettingsPage");
const settingsLoading = ref(false);
const settingsLoadingContext = useLoading("settings");

watch(
  () => settings.error,
  (newError) => {
    if (newError && settings.errorInfo) {
      errorStore.setError({
        message: settings.errorInfo.message,
        code: settings.errorInfo.code,
        suggestions: settings.errorInfo.suggestions,
        retryable: settings.errorInfo.retryable,
        context: {
          page: "settings",
          component: "SettingsPage",
        },
        originalError: settings.errorInfo.originalError,
      });
      settings.clearError();
    }
  },
);

watch(
  () => navigationStore.validationError,
  (validationError) => {
    if (validationError) {
      logger.debug("Navigation validation error detected", { validationError });

      errorStore.setError({
        message: validationError.message,
        code: validationError.code,
        suggestions: validationError.suggestions,
        retryable: true,
        context: {
          page: "settings",
          component: "SettingsPage",
          operation: "navigation",
        },
      });

      setTimeout(() => {
        navigationStore.clearValidationError();
      }, 100);
    }
  },
);

const centralizedProviderConfigs = ref<
  Array<{
    id: string;
    name: string;
    apiKeyUrl: string;
    apiKeyInput: string;
    additionalInfo?: string;
    hasEndpointType?: boolean;
    modelFallbackIds?: string[];
    defaultModel?: string;
    customFields?: Array<{
      id: string;
      label: string;
      type: "text" | "select";
      placeholder?: string;
      options?: string[];
      defaultValue?: string;
    }>;
  }>
>([]);

const providerCapabilities = ref<Record<string, any>>({});
const validating = ref(false);
const lastValidationValid = ref<boolean | null>(null);
const showValidationErrors = ref(false);
const validationErrors = ref<
  Array<string | { field?: string; code?: string; message: string; severity?: string }>
>([]);
const validationWarnings = ref<Array<string | { field?: string; code?: string; message: string }>>(
  [],
);

const isSettingsLoadingRaw = computed(
  () => settingsLoadingContext.isActive.value || settingsLoading.value || settings.loading,
);
const { displayLoading: isSettingsLoading } = useDelayedLoadingState(
  isSettingsLoadingRaw,
  computed(() => settingsLoadingContext.steps.value.length),
  { minDisplayTime: 300, perStepDelay: 100 },
);

const { providerConfigs } = useProviderConfigs(wiki, settings, centralizedProviderConfigs);

const getActualApiKey = (providerId: string) => {
  return settings.apiKeyInputs[providerId] || "";
};

const contentHeights = ref<Record<string, number>>({});

const calculateContentHeight = async (providerId: string) => {
  await nextTick();
  const element = document.getElementById(`provider-content-${providerId}`);
  if (element) {
    contentHeights.value[providerId] = element.scrollHeight;
  }
};

const {
  handleProviderChange,
  handleApiKeyChange,
  handleApiKeyFocus,
  handleApiKeyBlur,
  handleModelChange,
  handleCustomFieldChange,
  openExternalUrl,
} = useSettingsHandlers(
  wiki,
  settings,
  providerConfigs,
  validating,
  lastValidationValid,
  showValidationErrors,
  validationErrors,
  validationWarnings,
  getActualApiKey,
);

const { setupMessageListener, cleanup: cleanupMessageListener } = useSettingsMessaging(
  centralizedProviderConfigs,
  providerCapabilities,
  calculateContentHeight,
  providerConfigs,
  {
    onConfigurationValidated: (isValid, errors, warnings) => {
      // Configuration validation is now handled internally by the guard
      lastValidationValid.value = isValid;
      validationErrors.value = errors;
      validationWarnings.value = warnings;
    },
  },
);

const { initSettings } = useSettingsInitialization(settings, settingsLoading);

watch(
  () => settings.selectedProvider,
  (newProviderId) => {
    if (newProviderId) {
      nextTick(() => {
        calculateContentHeight(newProviderId);
      });
    }
  },
);

onMounted(() => {
  setupMessageListener();
  initSettings();

  // Create and register the navigation guard
  const guard = createSettingsNavigationGuard(settings, wiki, providerConfigs, getActualApiKey);

  logger.debug("Registering navigation guard");
  setNavigationGuard(guard);
  logger.debug("Navigation guard registered successfully");

  setTimeout(() => {
    providerConfigs.value.forEach((provider: { id: string }) => {
      calculateContentHeight(provider.id);
    });
  }, 100);
});

onBeforeUnmount(() => {
  cleanupMessageListener();
  setNavigationGuard(null);
});
</script>

<template>
  <div v-if="isSettingsLoading" class="flex h-full w-full">
    <LoadingState context="settings" />
  </div>
  <div v-else class="flex w-full min-w-0 flex-col">
    <!-- Compact Header -->
    <div class="flex items-center justify-between px-4 py-3">
      <div class="flex items-center gap-2">
        <div class="bg-primary/10 flex h-6 w-6 items-center justify-center rounded-md">
          <svg
            class="text-primary h-3 w-3"
            viewBox="0 0 24 24"
            fill="none"
          >
            <path
              d="M4 15.8294V15.75V8C4 7.69114 4.16659 7.40629 4.43579 7.25487L4.45131 7.24614L11.6182 3.21475L11.6727 3.18411C11.8759 3.06979 12.1241 3.06979 12.3273 3.18411L19.6105 7.28092C19.8511 7.41625 20 7.67083 20 7.94687V8V15.75V15.8294C20 16.1119 19.8506 16.3733 19.6073 16.5167L12.379 20.7766C12.1451 20.9144 11.8549 20.9144 11.621 20.7766L4.39267 16.5167C4.14935 16.3733 4 16.1119 4 15.8294Z"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path d="M12 21V12" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            <path d="M12 12L4 7.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            <path d="M20 7.5L12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
        </div>
        <div class="flex flex-col">
          <h2 class="text-foreground text-xs font-semibold tracking-tight">Providers</h2>
          <span class="text-muted-foreground text-[9px]">Configure AI models</span>
        </div>
      </div>
      <span
        v-if="settings.loadingProviders"
        class="text-muted-foreground flex items-center gap-1.5 rounded-full bg-muted/50 px-2 py-0.5 text-[9px] font-medium"
      >
        <svg class="h-2 w-2 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        Refreshing
      </span>
    </div>

    <!-- Subtle separator -->
    <div class="h-px bg-border/40" />

    <div
      v-if="settings.loadingProviders || (providerConfigs.length === 0 && !wiki.providers.length)"
      class="flex min-h-[120px] w-full items-center justify-center"
    >
      <LoadingState context="settings" />
    </div>

    <div v-else class="flex-1 space-y-1.5 px-3 py-3">
      <ProviderConfigItem
        v-for="provider in providerConfigs"
        :key="provider.id"
        :provider="provider"
        :is-selected="settings.selectedProvider === provider.id"
        :content-height="contentHeights[provider.id]"
        :provider-capabilities="providerCapabilities"
        @provider-change="handleProviderChange"
        @model-change="handleModelChange"
        @api-key-change="handleApiKeyChange"
        @api-key-focus="handleApiKeyFocus"
        @api-key-blur="handleApiKeyBlur"
        @custom-field-change="handleCustomFieldChange"
        @open-url="openExternalUrl"
        @calculate-height="calculateContentHeight"
      />
    </div>

    <!-- Compact footer -->
    <div class="border-t border-border/30 bg-muted/20 px-3 py-2">
      <p class="text-muted-foreground flex items-center gap-1.5 text-[9px] leading-snug">
        <svg class="h-2.5 w-2.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
        Keys stored securely in VSCode Secret Storage
      </p>
    </div>
  </div>
</template>
