import { ref, onMounted, onBeforeUnmount, type Ref } from "vue";

export type PageType =
  | "wiki"
  | "settings"
  | "errorHistory"
  | "savedWikis"
  | "promptManager"
  | "qualityDashboard"
  | "wikiAggregator";

const currentPage: Ref<PageType> = ref<PageType>("wiki");

export function useNavigation() {
  const setPage = (newPage: PageType): void => {
    if (
      newPage === "wiki" ||
      newPage === "settings" ||
      newPage === "errorHistory" ||
      newPage === "savedWikis" ||
      newPage === "promptManager" ||
      newPage === "qualityDashboard" ||
      newPage === "wikiAggregator"
    ) {
      currentPage.value = newPage;
    } else {
      console.error("[QWIKI]", "setPage - invalid page:", newPage);
    }
  };

  const handleMessage = (event: MessageEvent<{ command?: string; payload?: any }>): void => {
    const command = event.data?.command;
    if (command !== "navigate") return;

    const nextPage = event.data?.payload?.page;
    if (
      nextPage === "wiki" ||
      nextPage === "settings" ||
      nextPage === "errorHistory" ||
      nextPage === "savedWikis" ||
      nextPage === "promptManager" ||
      nextPage === "qualityDashboard" ||
      nextPage === "wikiAggregator"
    ) {
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
