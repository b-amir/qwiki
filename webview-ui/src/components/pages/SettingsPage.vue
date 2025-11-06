<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch, provide, onBeforeUnmount } from "vue";
import LoadingState from "@/components/features/LoadingState.vue";
import ProviderConfigItem from "@/components/features/ProviderConfigItem.vue";
import ErrorModal from "@/components/features/ErrorModal.vue";
import { useWikiStore } from "@/stores/wiki";
import { useSettingsStore } from "@/stores/settings";
import { useLoading } from "@/loading/useLoading";
import { useDelayedLoadingState } from "@/composables/useDelayedLoadingState";
import { useSettingsMessaging } from "@/composables/useSettingsMessaging";
import { useProviderConfigs } from "@/composables/useProviderConfigs";
import { useSettingsHandlers } from "@/composables/useSettingsHandlers";
import { useSettingsInitialization } from "@/composables/useSettingsInitialization";
import { useSettingsNavigationGuard } from "@/composables/useSettingsNavigationGuard";
import { useNavigation, type PageType } from "@/composables/useNavigation";
import { createLogger } from "@/utilities/logging";

const wiki = useWikiStore();
const settings = useSettingsStore();
const { setNavigationGuard } = useNavigation();
const logger = createLogger("SettingsPage");
const settingsLoading = ref(false);
const settingsLoadingContext = useLoading("settings");
const errorModalOpen = ref(false);

watch(
  () => settings.error,
  (newError, oldError) => {
    logger.debug("Settings error watch triggered", {
      newError,
      oldError,
      hasErrorInfo: !!settings.errorInfo,
      errorModalOpen: errorModalOpen.value,
    });
    if (newError && newError !== oldError) {
      errorModalOpen.value = true;
      logger.debug("Error detected, opening error modal", {
        error: newError,
        errorInfo: settings.errorInfo,
        errorModalOpen: errorModalOpen.value,
      });
    } else if (!newError) {
      errorModalOpen.value = false;
    }
  },
  { immediate: true },
);

watch(
  () => settings.errorInfo,
  (newErrorInfo, oldErrorInfo) => {
    logger.debug("Settings errorInfo watch triggered", {
      newErrorInfo: !!newErrorInfo,
      oldErrorInfo: !!oldErrorInfo,
      hasError: !!settings.error,
      errorModalOpen: errorModalOpen.value,
    });
    if (newErrorInfo && settings.error) {
      errorModalOpen.value = true;
      logger.debug("ErrorInfo set, opening error modal", {
        error: settings.error,
        errorInfo: newErrorInfo,
        errorModalOpen: errorModalOpen.value,
      });
    } else if (!newErrorInfo && !settings.error) {
      errorModalOpen.value = false;
    }
  },
  { immediate: true },
);

watch(
  () => errorModalOpen.value,
  (isOpen) => {
    if (isOpen && settings.error) {
      logger.debug("Error modal opened", { error: settings.error });
    }
  },
);

const shouldShowErrorModal = computed(() => {
  if (!settings.errorInfo?.context) return true;
  try {
    const context = JSON.parse(settings.errorInfo.context);
    const errorProviderId = context?.providerId;
    const isGlobalError = context?.globalError === true;
    return isGlobalError || !errorProviderId || errorProviderId === settings.selectedProvider;
  } catch {
    return true;
  }
});

const errorModalMessage = computed(() => {
  if (!settings.errorInfo?.context) return settings.error;
  try {
    const context = JSON.parse(settings.errorInfo.context);
    if (context?.providerId && context.providerId !== settings.selectedProvider) {
      return "";
    }
  } catch {
    return settings.error;
  }
  return settings.error;
});

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

const getApiKeyInput = (providerId: string) => {
  const input = settings.apiKeyInputs[providerId] || "";
  const hasSavedKey =
    settings.originalApiKeys[providerId] &&
    settings.originalApiKeys[providerId].length > 0 &&
    input === settings.originalApiKeys[providerId];
  return hasSavedKey
    ? "•".repeat(Math.min(settings.originalApiKeys[providerId].length, 20))
    : input;
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
  getApiKeyInput,
);

const navigationGuard = useSettingsNavigationGuard(
  wiki,
  settings,
  providerConfigs,
  getApiKeyInput,
  validating,
  lastValidationValid,
  showValidationErrors,
  validationErrors,
  validationWarnings,
);

provide("settingsNavigationGuard", navigationGuard);

const { setupMessageListener, cleanup: cleanupMessageListener } = useSettingsMessaging(
  centralizedProviderConfigs,
  providerCapabilities,
  calculateContentHeight,
  providerConfigs,
  {
    onConfigurationValidated: (isValid, errors, warnings) => {
      navigationGuard.handleValidationComplete(isValid, errors, warnings);
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

  const guard = async (target: PageType, isBack: boolean): Promise<boolean> => {
    if (target === "settings") {
      return true;
    }
    logger.debug(`Navigation guard triggered - target: ${target}, isBack: ${isBack}`);
    try {
      const result = await navigationGuard.validateAndNavigate(target, isBack);
      logger.debug(
        `Navigation guard result - isValid: ${result.isValid}, errors: ${result.errors.length}`,
        {
          errors: result.errors,
          warnings: result.warnings,
        },
      );
      if (!result.isValid) {
        logger.debug(`Navigation blocked due to validation errors`);

        if (result.errors.length > 0) {
          const firstError = result.errors[0];
          const errorMessage = typeof firstError === "string" ? firstError : firstError.message;
          const errorCode =
            typeof firstError === "string"
              ? "VALIDATION_ERROR"
              : firstError.code || "VALIDATION_ERROR";

          logger.debug(`Setting error in navigation guard`, {
            errorMessage,
            errorCode,
            currentError: settings.error,
          });

          if (!settings.error || settings.error !== errorMessage) {
            settings.error = errorMessage;
            settings.errorInfo = {
              message: errorMessage,
              code: errorCode,
              suggestions: [
                "Please review the validation errors above",
                "Fix the errors before continuing",
              ],
              retryable: false,
              timestamp: new Date().toISOString(),
              context: JSON.stringify({ providerId: settings.selectedProvider }),
            };

            logger.debug(`Error set in settings store from navigation guard`, {
              error: settings.error,
              errorInfo: settings.errorInfo,
            });
          }
        }
        return false;
      }
      return true;
    } catch (error) {
      logger.error("Navigation guard error", error);
      return true;
    }
  };

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

    <ErrorModal
      v-if="settings.error && settings.errorInfo && shouldShowErrorModal"
      v-model="errorModalOpen"
      :error="errorModalMessage"
      :error-code="settings.errorInfo.code"
      :suggestions="settings.errorInfo.suggestions"
      :retryable="settings.errorInfo.retryable"
      :timestamp="settings.errorInfo.timestamp"
      :context="settings.errorInfo.context"
      :original-error="settings.errorInfo.originalError"
      @close="
        () => {
          errorModalOpen = false;
          settings.clearError();
        }
      "
    />
  </div>
</template>
