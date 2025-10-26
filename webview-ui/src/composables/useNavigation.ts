import { ref, onMounted, onBeforeUnmount, type Ref } from "vue";

export type PageType = "wiki" | "settings";

// Move the state outside the function to make it truly shared
const currentPage: Ref<PageType> = ref<PageType>("wiki");

export function useNavigation() {
  // Navigate to a specific page
  const setPage = (newPage: PageType): void => {
    console.log("[DEBUG] setPage called with:", newPage);
    console.log("[DEBUG] setPage - currentPage before:", currentPage.value);
    if (newPage === "wiki" || newPage === "settings") {
      currentPage.value = newPage;
      console.log("[DEBUG] setPage - currentPage after:", currentPage.value);
    } else {
      console.log("[DEBUG] setPage - invalid page:", newPage);
    }
  };

  // Message handler for navigation events from VSCode extension
  const handleMessage = (event: MessageEvent<{ command?: string; payload?: any }>): void => {
    const command = event.data?.command;
    if (command !== "navigate") return;

    const nextPage = event.data?.payload?.page;
    if (nextPage === "wiki" || nextPage === "settings") {
      currentPage.value = nextPage;
    }
  };

  // Set up and clean up event listeners for VSCode messages
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
