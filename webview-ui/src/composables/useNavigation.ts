import { computed, onMounted, onBeforeUnmount } from "vue";
import { useNavigationStore, type PageType, type NavigationGuard } from "@/stores/navigation";
import { createLogger } from "@/utilities/logging";

const logger = createLogger("useNavigation");

export type { PageType, NavigationGuard };

export function useNavigation() {
  const navigationStore = useNavigationStore();

  const handleMessage = (event: MessageEvent<{ command?: string; payload?: unknown }>): void => {
    const command = event.data?.command;
    if (command !== "navigate") return;

    const payload = event.data?.payload;
    if (!payload || typeof payload !== "object" || payload === null) return;

    const navigatePayload = payload as { page?: unknown; isBack?: unknown };
    const nextPage = navigatePayload.page as PageType;
    const isBack = Boolean(navigatePayload.isBack);

    logger.info("navigate message received", {
      nextPage,
      isBack,
      currentPage: navigationStore.currentPage,
    });

    // Validate page type
    const validPages: PageType[] = [
      "wiki",
      "settings",
      "errorHistory",
      "savedWikis",
      "promptManager",
      "qualityDashboard",
      "wikiAggregator",
    ];

    if (validPages.includes(nextPage)) {
      navigationStore.handleNavigationMessage(nextPage, isBack);
    } else {
      logger.error("Invalid page in navigate message", { nextPage });
    }
  };

  onMounted(() => {
    logger.info("useNavigation mounted", { initialPage: navigationStore.currentPage });
    window.addEventListener("message", handleMessage);
  });

  onBeforeUnmount(() => {
    logger.debug("useNavigation unmounting");
    window.removeEventListener("message", handleMessage);
  });

  return {
    // Reactive properties from store
    currentPage: computed(() => navigationStore.currentPage),
    isNavigating: computed(() => navigationStore.isNavigating),
    isValidating: computed(() => navigationStore.isValidating),
    validationError: computed(() => navigationStore.currentError),

    // Methods
    navigateTo: (page: PageType, isBack?: boolean) => navigationStore.navigateTo(page, isBack),
    setNavigationGuard: (guard: NavigationGuard | null) => navigationStore.setGuard(guard),
  };
}
