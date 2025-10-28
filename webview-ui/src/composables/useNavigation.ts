import { ref, onMounted, onBeforeUnmount, type Ref } from "vue";

export type PageType = "wiki" | "settings";

const currentPage: Ref<PageType> = ref<PageType>("wiki");

export function useNavigation() {
  const setPage = (newPage: PageType): void => {
    if (newPage === "wiki" || newPage === "settings") {
      currentPage.value = newPage;
    } else {
      console.error("setPage - invalid page:", newPage);
    }
  };

  const handleMessage = (event: MessageEvent<{ command?: string; payload?: any }>): void => {
    const command = event.data?.command;
    if (command !== "navigate") return;

    const nextPage = event.data?.payload?.page;
    if (nextPage === "wiki" || nextPage === "settings") {
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
