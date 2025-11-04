import { ref, onMounted, onBeforeUnmount, type Ref } from "vue";
import { useNavigationStatusStore } from "@/stores/navigationStatus";
import { createLogger } from "@/utilities/logging";

export type PageType =
  | "wiki"
  | "settings"
  | "errorHistory"
  | "savedWikis"
  | "promptManager"
  | "qualityDashboard"
  | "wikiAggregator";

type NavigationGuard = (target: PageType, isBack: boolean) => Promise<boolean>;

const currentPage: Ref<PageType> = ref<PageType>("wiki");
const isValidating: Ref<boolean> = ref(false);
const logger = createLogger("useNavigation");
let navigationGuard: NavigationGuard | null = null;

export function useNavigation() {
  const navigationStatusStore = useNavigationStatusStore();

  const setNavigationGuard = (guard: NavigationGuard | null) => {
    navigationGuard = guard;
  };

  const setPage = async (newPage: PageType, isBack: boolean = false): Promise<void> => {
    logger.debug(
      `setPage called - newPage: ${newPage}, isBack: ${isBack}, currentPage: ${currentPage.value}, hasGuard: ${!!navigationGuard}`,
    );
    if (
      newPage === "wiki" ||
      newPage === "settings" ||
      newPage === "errorHistory" ||
      newPage === "savedWikis" ||
      newPage === "promptManager" ||
      newPage === "qualityDashboard" ||
      newPage === "wikiAggregator"
    ) {
      if (currentPage.value !== newPage) {
        if (navigationGuard) {
          logger.debug(`Calling navigation guard for ${newPage}`);
          isValidating.value = true;
          try {
            const canNavigate = await navigationGuard(newPage, isBack);
            logger.debug(`Navigation guard returned: ${canNavigate}`);
            if (!canNavigate) {
              logger.debug("Navigation blocked by guard");
              return;
            }
          } finally {
            isValidating.value = false;
          }
        } else {
          logger.debug("No navigation guard set, allowing navigation");
        }

        navigationStatusStore.start(newPage, isBack);
      } else {
        logger.debug(`Already on page ${newPage}, skipping navigation`);
      }
      currentPage.value = newPage;
    } else {
      logger.error("setPage received invalid page", newPage);
    }
  };

  const handleMessage = (event: MessageEvent<{ command?: string; payload?: any }>): void => {
    const command = event.data?.command;
    if (command !== "navigate") return;

    const nextPage = event.data?.payload?.page;
    const isBack = event.data?.payload?.isBack || false;

    logger.info("navigate message received", {
      nextPage,
      isBack,
      currentPage: currentPage.value,
    });

    if (
      nextPage === "wiki" ||
      nextPage === "settings" ||
      nextPage === "errorHistory" ||
      nextPage === "savedWikis" ||
      nextPage === "promptManager" ||
      nextPage === "qualityDashboard" ||
      nextPage === "wikiAggregator"
    ) {
      if (currentPage.value !== nextPage) {
        logger.info("Changing page", { from: currentPage.value, to: nextPage, isBack });
        navigationStatusStore.start(nextPage, isBack);
      } else {
        logger.debug("Already on page, skipping navigation", { page: nextPage });
      }
      currentPage.value = nextPage;
      logger.info("Page updated", { newPage: currentPage.value });
    } else {
      logger.error("Invalid page in navigate message", { nextPage });
    }
  };

  onMounted(() => {
    logger.info("useNavigation mounted", { initialPage: currentPage.value });
    window.addEventListener("message", handleMessage);
  });

  onBeforeUnmount(() => {
    window.removeEventListener("message", handleMessage);
  });

  return {
    currentPage,
    isValidating,
    setPage,
    setNavigationGuard,
    handleMessage,
  };
}
