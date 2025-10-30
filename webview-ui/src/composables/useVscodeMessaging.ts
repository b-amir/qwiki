import { ref, onMounted, onBeforeUnmount } from "vue";
import { vscode } from "@/utilities/vscode";

export function useVscodeMessaging() {
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  const postMessage = (message: { command: string; payload?: any }) => {
    try {
      vscode.postMessage(message);
    } catch (err) {
      console.error("[QWIKI] Failed to post message:", err);
      error.value = "Failed to send message to extension";
    }
  };

  const setLoading = (loading: boolean) => {
    isLoading.value = loading;
  };

  const setError = (errorMessage: string | null) => {
    error.value = errorMessage;
  };

  return {
    vscode,
    isLoading,
    error,
    postMessage,
    setLoading,
    setError,
  };
}
