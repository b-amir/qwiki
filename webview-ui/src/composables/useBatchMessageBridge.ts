import { onMounted, onBeforeUnmount } from "vue";

export function useBatchMessageBridge() {
  const handler = (event: MessageEvent) => {
    const data = (event as any).data as { command?: string; payload?: any };
    if (data?.command !== "batch") return;
    const messages = data?.payload?.messages;
    if (!Array.isArray(messages)) return;
    for (const m of messages) {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { command: m.command, payload: m.payload },
        }),
      );
    }
  };

  onMounted(() => {
    window.addEventListener("message", handler);
  });

  onBeforeUnmount(() => {
    window.removeEventListener("message", handler);
  });
}
