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
  | "wikiAggregator"
  | "wikiAggregation"
  | "readmeUpdate";

const currentPage: Ref<PageType> = ref<PageType>("wiki");
const logger = createLogger("useNavigation");

export function useNavigation() {
  const navigationStatusStore = useNavigationStatusStore();
  const setPage = (newPage: PageType, isBack: boolean = false): void => {
    if (
      newPage === "wiki" ||
      newPage === "settings" ||
      newPage === "errorHistory" ||
      newPage === "savedWikis" ||
      newPage === "promptManager" ||
      newPage === "qualityDashboard" ||
      newPage === "wikiAggregator" ||
      newPage === "wikiAggregation" ||
      newPage === "readmeUpdate"
    ) {
      if (currentPage.value !== newPage) {
        navigationStatusStore.start(newPage, isBack);
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

    if (
      nextPage === "wiki" ||
      nextPage === "settings" ||
      nextPage === "errorHistory" ||
      nextPage === "savedWikis" ||
      nextPage === "promptManager" ||
      nextPage === "qualityDashboard" ||
      nextPage === "wikiAggregator" ||
      nextPage === "wikiAggregation" ||
      nextPage === "readmeUpdate"
    ) {
      if (currentPage.value !== nextPage) {
        navigationStatusStore.start(nextPage, isBack);
      }
      currentPage.value = nextPage;
    }
  };

  onMounted(() => {
    window.addEventListener("message", handleMessage);
  });

  onBeforeUnmount(() => {
    window.removeEventListener("message", handleMessage);
  });

  return {
    currentPage,
    setPage,
    handleMessage,
  };
}
