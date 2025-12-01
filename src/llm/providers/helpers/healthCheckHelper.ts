import type { HealthCheckResult } from "@/llm/types/ProviderCapabilities";

function sanitizeHeader(value: string): string {
  return value
    .split("")
    .map((char) => (char.charCodeAt(0) > 127 ? "" : char))
    .join("");
}

export async function performHealthCheck(
  url: string,
  headers: Record<string, string> = {},
): Promise<HealthCheckResult> {
  const startTime = Date.now();
  try {
    const sanitizedHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };
    for (const [key, value] of Object.entries(headers)) {
      sanitizedHeaders[key] = sanitizeHeader(value);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(url, {
      method: "GET",
      headers: sanitizedHeaders,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const responseTime = Date.now() - startTime;
    if (response.ok) {
      return { isHealthy: true, responseTime, lastChecked: new Date() };
    }
    return {
      isHealthy: false,
      responseTime,
      error: `HTTP ${response.status}: ${response.statusText}`,
      lastChecked: new Date(),
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const isTimeout = errorMessage.includes("abort") || errorMessage.includes("timeout");
    return {
      isHealthy: false,
      responseTime,
      error: isTimeout ? "Health check timed out" : errorMessage,
      lastChecked: new Date(),
    };
  }
}
