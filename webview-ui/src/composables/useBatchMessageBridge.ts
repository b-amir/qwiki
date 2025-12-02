import { onMounted, onBeforeUnmount, ref } from "vue";
import { createLogger } from "@/utilities/logging";

const lastPayloadByCommand = new Map<string, string>();
const lastExecutionTime = new Map<string, number>();
const DEDUP_IN_BATCH = new Set<string>([
  "environmentStatus",
  "getSavedWikis",
  "navigate",
  "loadingStep",
]);
const DEDUP_ACROSS_BATCHES = new Set<string>(["environmentStatus", "getSavedWikis", "navigate"]);
const THROTTLED_COMMANDS = new Set<string>(["getSavedWikis"]);
const ANIMATION_COMMANDS = new Set<string>(["loadingStep", "wikiContentChunk"]);
const THROTTLE_DELAY = 1000;
const LATENCY_WARNING_THRESHOLD = 100;
const BATCH_PROCESSING_WARNING_THRESHOLD = 100;
const MAX_METRICS_HISTORY = 100;
const logger = createLogger("BatchBridge");

interface MessageLatencyMetric {
  command: string;
  latency: number;
  timestamp: number;
}

interface BatchProcessingMetric {
  batchSize: number;
  messagesForwarded: number;
  processingTime: number;
  deduplicatedCount: number;
  throttledCount: number;
  timestamp: number;
}

const batchMetrics = ref<BatchProcessingMetric[]>([]);
const messageLatencyMetrics = ref<MessageLatencyMetric[]>([]);

function stringifyPayload(payload: unknown): string {
  try {
    return JSON.stringify(payload);
  } catch {
    return String(payload);
  }
}

function addBatchMetric(metric: BatchProcessingMetric): void {
  batchMetrics.value.push(metric);
  if (batchMetrics.value.length > MAX_METRICS_HISTORY) {
    batchMetrics.value.shift();
  }
}

function addLatencyMetric(metric: MessageLatencyMetric): void {
  messageLatencyMetrics.value.push(metric);
  if (messageLatencyMetrics.value.length > MAX_METRICS_HISTORY) {
    messageLatencyMetrics.value.shift();
  }
}

function getBatchStatistics(): {
  totalBatches: number;
  averageBatchSize: number;
  averageProcessingTime: number;
  averageMessagesForwarded: number;
  averageDeduplicatedCount: number;
} {
  const metrics = batchMetrics.value;
  if (metrics.length === 0) {
    return {
      totalBatches: 0,
      averageBatchSize: 0,
      averageProcessingTime: 0,
      averageMessagesForwarded: 0,
      averageDeduplicatedCount: 0,
    };
  }

  let totalBatchSize = 0;
  let totalProcessingTime = 0;
  let totalMessagesForwarded = 0;
  let totalDeduplicatedCount = 0;

  for (const metric of metrics) {
    totalBatchSize += metric.batchSize;
    totalProcessingTime += metric.processingTime;
    totalMessagesForwarded += metric.messagesForwarded;
    totalDeduplicatedCount += metric.deduplicatedCount;
  }

  const count = metrics.length;
  return {
    totalBatches: count,
    averageBatchSize: totalBatchSize / count,
    averageProcessingTime: totalProcessingTime / count,
    averageMessagesForwarded: totalMessagesForwarded / count,
    averageDeduplicatedCount: totalDeduplicatedCount / count,
  };
}

function getLatencyStatistics(): {
  totalMessages: number;
  averageLatency: number;
  maxLatency: number;
  slowMessagesCount: number;
} {
  const metrics = messageLatencyMetrics.value;
  if (metrics.length === 0) {
    return {
      totalMessages: 0,
      averageLatency: 0,
      maxLatency: 0,
      slowMessagesCount: 0,
    };
  }

  let totalLatency = 0;
  let maxLatency = 0;
  let slowMessagesCount = 0;

  for (const metric of metrics) {
    totalLatency += metric.latency;
    if (metric.latency > maxLatency) {
      maxLatency = metric.latency;
    }
    if (metric.latency > LATENCY_WARNING_THRESHOLD) {
      slowMessagesCount++;
    }
  }

  return {
    totalMessages: metrics.length,
    averageLatency: totalLatency / metrics.length,
    maxLatency,
    slowMessagesCount,
  };
}

function dispatchWithAnimationFrame(
  message: { command: string; payload: unknown },
  batchReceiveTime: number,
): void {
  requestAnimationFrame(() => {
    const forwardTime = performance.now();
    const latency = forwardTime - batchReceiveTime;

    window.dispatchEvent(
      new MessageEvent("message", {
        data: { command: message.command, payload: message.payload },
      }),
    );

    addLatencyMetric({
      command: message.command,
      latency,
      timestamp: Date.now(),
    });

    if (latency > LATENCY_WARNING_THRESHOLD) {
      logger.warn(`High latency for animation command ${message.command}: ${latency.toFixed(2)}ms`);
    }
  });
}

function dispatchImmediately(
  message: { command: string; payload: unknown },
  batchReceiveTime: number,
): void {
  const forwardTime = performance.now();
  const latency = forwardTime - batchReceiveTime;

  window.dispatchEvent(
    new MessageEvent("message", {
      data: { command: message.command, payload: message.payload },
    }),
  );

  addLatencyMetric({
    command: message.command,
    latency,
    timestamp: Date.now(),
  });

  if (latency > LATENCY_WARNING_THRESHOLD) {
    logger.warn(`High latency for command ${message.command}: ${latency.toFixed(2)}ms`);
  }
}

interface BatchMessage {
  command: string;
  payload?: unknown;
}

interface BatchPayload {
  messages?: unknown[];
}

function isNewerLoadingStep(msg1: BatchMessage, msg2: BatchMessage): boolean {
  const seq1 = (msg1.payload as { sequence?: number })?.sequence ?? 0;
  const seq2 = (msg2.payload as { sequence?: number })?.sequence ?? 0;

  if (seq1 !== seq2) {
    return seq1 > seq2;
  }

  const ts1 = (msg1 as { timestamp?: number }).timestamp ?? 0;
  const ts2 = (msg2 as { timestamp?: number }).timestamp ?? 0;
  return ts1 > ts2;
}

export function useBatchMessageBridge() {
  const handler = (event: MessageEvent) => {
    const batchReceiveTime = performance.now();
    const data = event.data as unknown as { command?: string; payload?: BatchPayload };
    if (data?.command !== "batch") return;
    const messages = data?.payload?.messages;
    if (!Array.isArray(messages)) return;

    const processingStartTime = performance.now();
    let deduplicatedCount = 0;
    let throttledCount = 0;

    try {
      const cmds = messages
        .map((m: unknown) =>
          m && typeof m === "object" && "command" in m
            ? (m as { command?: string }).command
            : undefined,
        )
        .filter((cmd): cmd is string => typeof cmd === "string");
      logger.debug(`Batch received: ${messages.length} messages [${cmds.join(", ")}]`);
    } catch {}

    const seenInBatch = new Set<string>();
    const loadingStepsByContext = new Map<string, BatchMessage[]>();
    const coalesced: BatchMessage[] = [];
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (
        !m ||
        typeof m !== "object" ||
        m === null ||
        !("command" in m) ||
        typeof (m as BatchMessage).command !== "string"
      )
        continue;
      const message = m as BatchMessage;

      if (message.command === "loadingStep" && message.payload) {
        const payload = message.payload as { step?: string; sequence?: number; context?: string };
        const step = payload.step;
        const sequence = payload.sequence;
        const context =
          payload.context || (step && step.includes("extension") ? "environment" : "wiki");

        if (context) {
          const key = `loadingStep:${context}`;
          const existing = loadingStepsByContext.get(key);

          if (sequence !== undefined) {
            if (!existing) {
              loadingStepsByContext.set(key, [message]);
            } else {
              const existingSeqs = existing.map(
                (m) => (m.payload as { sequence?: number })?.sequence ?? 0,
              );
              if (!existingSeqs.includes(sequence)) {
                existing.push(message);
              }
            }
          } else {
            if (!existing || isNewerLoadingStep(message, existing[existing.length - 1])) {
              loadingStepsByContext.set(key, [message]);
            }
          }
          continue;
        }
      }

      if (DEDUP_IN_BATCH.has(message.command)) {
        if (seenInBatch.has(message.command)) {
          deduplicatedCount++;
          continue;
        }
        seenInBatch.add(message.command);
        coalesced.push(message);
      } else {
        coalesced.push(message);
      }
    }

    for (const steps of loadingStepsByContext.values()) {
      for (const step of steps) {
        coalesced.push(step);
      }
    }

    coalesced.reverse();

    const toForward: Array<{ command: string; payload: unknown }> = [];
    const now = Date.now();

    for (const m of coalesced) {
      if (!m || !m.command) continue;

      if (THROTTLED_COMMANDS.has(m.command)) {
        const lastTime = lastExecutionTime.get(m.command) || 0;
        if (now - lastTime < THROTTLE_DELAY) {
          throttledCount++;
          logger.debug(`Throttling command ${m.command}, last executed ${now - lastTime}ms ago`);
          continue;
        }
        lastExecutionTime.set(m.command, now);
      }

      if (DEDUP_ACROSS_BATCHES.has(m.command)) {
        const key = m.command;
        const snapshot = stringifyPayload(m.payload);
        const last = lastPayloadByCommand.get(key);
        if (last === snapshot) {
          deduplicatedCount++;
          continue;
        }
        lastPayloadByCommand.set(key, snapshot);
        toForward.push({ command: m.command, payload: m.payload ?? undefined });
      } else {
        toForward.push({ command: m.command, payload: m.payload ?? undefined });
      }
    }

    const animationMessages: Array<{ command: string; payload: unknown }> = [];
    const regularMessages: Array<{ command: string; payload: unknown }> = [];

    for (const m of toForward) {
      if (ANIMATION_COMMANDS.has(m.command)) {
        animationMessages.push(m);
      } else {
        regularMessages.push(m);
      }
    }

    for (const m of regularMessages) {
      dispatchImmediately(m, batchReceiveTime);
    }

    for (const m of animationMessages) {
      dispatchWithAnimationFrame(m, batchReceiveTime);
    }

    const processingEndTime = performance.now();
    const processingTime = processingEndTime - processingStartTime;

    addBatchMetric({
      batchSize: messages.length,
      messagesForwarded: toForward.length,
      processingTime,
      deduplicatedCount,
      throttledCount,
      timestamp: Date.now(),
    });

    if (processingTime > BATCH_PROCESSING_WARNING_THRESHOLD) {
      logger.warn(
        `Slow batch processing: ${processingTime.toFixed(2)}ms for ${messages.length} messages`,
      );
    }

    if (toForward.length > 1) {
      logger.debug(
        `Forwarded ${toForward.length} messages (${regularMessages.length} regular, ${animationMessages.length} animation)`,
      );
    }

    const batchStats = getBatchStatistics();
    const latencyStats = getLatencyStatistics();

    if (batchMetrics.value.length % 10 === 0 && batchMetrics.value.length > 0) {
      logger.debug("Batch performance stats", {
        batches: batchStats.totalBatches,
        avgBatchSize: batchStats.averageBatchSize.toFixed(1),
        avgProcessingTime: batchStats.averageProcessingTime.toFixed(2),
        avgLatency: latencyStats.averageLatency.toFixed(2),
        slowMessages: latencyStats.slowMessagesCount,
      });
    }
  };

  onMounted(() => {
    window.addEventListener("message", handler);
  });

  onBeforeUnmount(() => {
    window.removeEventListener("message", handler);
  });

  return {
    getBatchStatistics,
    getLatencyStatistics,
  };
}
