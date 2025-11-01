import { onMounted, onBeforeUnmount } from "vue";
import { vscode } from "@/utilities/vscode";
import { createLogger } from "@/utilities/logging";

const lastPayloadByCommand = new Map<string, string>();
const lastExecutionTime = new Map<string, number>();
const DEDUP_IN_BATCH = new Set<string>(["environmentStatus", "getSavedWikis"]);
const DEDUP_ACROSS_BATCHES = new Set<string>(["environmentStatus", "getSavedWikis"]);
const THROTTLED_COMMANDS = new Set<string>(["getSavedWikis"]);
const THROTTLE_DELAY = 1000;
const logger = createLogger("BatchBridge");

function stringifyPayload(payload: any): string {
  try {
    return JSON.stringify(payload);
  } catch {
    return String(payload);
  }
}

export function useBatchMessageBridge() {
  const handler = (event: MessageEvent) => {
    const data = (event as any).data as { command?: string; payload?: any };
    if (data?.command !== "batch") return;
    const messages = data?.payload?.messages;
    if (!Array.isArray(messages)) return;
    try {
      const cmds = messages.map((m: any) => m?.command).filter(Boolean);
      logger.debug(
        `Received batch with ${messages.length} messages -> [${cmds.join(", ")}]`,
      );
      vscode.postMessage({
        command: "frontendLog",
        payload: {
          message: `BatchBridge: Received batch with ${messages.length} messages -> [${cmds.join(", ")}]`,
        },
      });
    } catch {}

    const seenInBatch = new Set<string>();
    const coalesced: Array<{ command: string; payload: any }> = [];
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (!m || !m.command) continue;
      if (DEDUP_IN_BATCH.has(m.command)) {
        if (seenInBatch.has(m.command)) continue; // skip earlier duplicates
        seenInBatch.add(m.command);
        coalesced.push(m);
      } else {
        coalesced.push(m);
      }
    }
    coalesced.reverse();

    const toForward: Array<{ command: string; payload: any }> = [];
    const now = Date.now();

    for (const m of coalesced) {
      if (!m || !m.command) continue;

      if (THROTTLED_COMMANDS.has(m.command)) {
        const lastTime = lastExecutionTime.get(m.command) || 0;
        if (now - lastTime < THROTTLE_DELAY) {
          logger.debug(
            `Throttling command ${m.command}, last executed ${now - lastTime}ms ago`,
          );
          continue;
        }
        lastExecutionTime.set(m.command, now);
      }

      if (DEDUP_ACROSS_BATCHES.has(m.command)) {
        const key = m.command;
        const snapshot = stringifyPayload(m.payload);
        const last = lastPayloadByCommand.get(key);
        if (last === snapshot) {
          continue;
        }
        lastPayloadByCommand.set(key, snapshot);
        toForward.push(m);
      } else {
        toForward.push(m);
      }
    }

    for (const m of toForward) {
      try {
        logger.debug(`Forwarding command ${m?.command}`);
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
