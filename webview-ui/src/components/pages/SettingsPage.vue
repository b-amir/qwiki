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
  <div
    v-else
    class="mx-auto w-full max-w-3xl space-y-4 p-3 sm:space-y-6 sm:p-4 md:space-y-8 md:p-6"
  >
    <section class="border-border bg-background mb-4 rounded-2xl border shadow-sm sm:mb-6 md:mb-8">
      <div class="space-y-4 px-3 py-3 sm:space-y-6 sm:px-4 sm:py-4 md:space-y-6 md:px-6 md:py-5">
        <div
          class="flex flex-col gap-2 px-3 pb-3 pt-3 sm:gap-2.5 sm:px-4 sm:pb-4 sm:pt-4 md:gap-3 md:px-6 md:pb-5 md:pt-6"
        >
          <div class="space-y-1 sm:space-y-1.5">
            <div class="flex items-center gap-2 sm:gap-2.5 md:gap-3">
              <svg
                class="text-foreground h-4 w-4 flex-shrink-0 sm:h-5 sm:w-5 md:h-6 md:w-6"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M4 15.8294V15.75V8C4 7.69114 4.16659 7.40629 4.43579 7.25487L4.45131 7.24614L11.6182 3.21475L11.6727 3.18411C11.8759 3.06979 12.1241 3.06979 12.3273 3.18411L19.6105 7.28092C19.8511 7.41625 20 7.67083 20 7.94687V8V15.75V15.8294C20 16.1119 19.8506 16.3733 19.6073 16.5167L12.379 20.7766C12.1451 20.9144 11.8549 20.9144 11.621 20.7766L4.39267 16.5167C4.14935 16.3733 4 16.1119 4 15.8294Z"
                  stroke="currentColor"
                  stroke-width="2"
                />
                <path d="M12 21V12" stroke="currentColor" stroke-width="2" />
                <path d="M12 12L4 7.5" stroke="currentColor" stroke-width="2" />
                <path d="M20 7.5L12 12" stroke="currentColor" stroke-width="2" />
              </svg>
              <h2
                class="text-foreground text-sm font-semibold leading-snug sm:text-base md:text-lg lg:text-xl"
              >
                Providers
              </h2>
            </div>
            <p class="text-muted-foreground text-xs leading-relaxed sm:text-sm md:text-sm">
              Choose the models and credentials that power your wiki.
            </p>
          </div>
          <span
            v-if="settings.loadingProviders"
            class="text-muted-foreground text-xs font-medium uppercase tracking-wide sm:text-xs"
          >
            Refreshing providers
          </span>
        </div>

        <div
          v-if="
            settings.loadingProviders || (providerConfigs.length === 0 && !wiki.providers.length)
          "
          class="flex h-full min-h-64 w-full"
        >
          <LoadingState context="settings" />
        </div>

        <div v-else class="space-y-3 sm:space-y-4 md:space-y-5">
          <div
            class="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between md:gap-3"
          >
            <h3
              class="text-muted-foreground text-xs font-semibold uppercase tracking-wide sm:text-xs md:text-sm"
            >
              LLM Provider
            </h3>
          </div>

          <div class="space-y-2 sm:space-y-3 md:space-y-4">
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
        </div>
      </div>

      <footer
        class="border-border bg-muted/10 text-muted-foreground break-words border-t px-3 py-2.5 text-xs leading-relaxed sm:px-4 sm:py-3 sm:text-xs md:px-6 md:py-4 md:text-sm"
      >
        Keys are stored securely in VS Code Secret Storage.
      </footer>
    </section>
  </div>
</template>
