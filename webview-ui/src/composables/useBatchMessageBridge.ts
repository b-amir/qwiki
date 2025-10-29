import { onMounted, onBeforeUnmount } from "vue";
import { vscode } from "@/utilities/vscode";

export function useBatchMessageBridge() {
  const handler = (event: MessageEvent) => {
    const data = (event as any).data as { command?: string; payload?: any };
    if (data?.command !== "batch") return;
    const messages = data?.payload?.messages;
    if (!Array.isArray(messages)) return;
    try {
      const cmds = messages.map((m: any) => m?.command).filter(Boolean);
      console.log(
        `[QWIKI] BatchBridge: Received batch with ${messages.length} messages -> [${cmds.join(", ")}]`,
      );
      vscode.postMessage({
        command: "frontendLog",
        payload: {
          message: `BatchBridge: Received batch with ${messages.length} messages -> [${cmds.join(", ")}]`,
        },
      });
    } catch {}
    for (const m of messages) {
      try {
        console.log(`[QWIKI] BatchBridge: Forwarding command ${m?.command}`);
        vscode.postMessage({
          command: "frontendLog",
          payload: { message: `BatchBridge: Forwarding command ${m?.command}` },
        });
      } catch {}
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
