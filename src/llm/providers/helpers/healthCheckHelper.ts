import type { HealthCheckResult } from "../../types/ProviderCapabilities";

export async function performHealthCheck(
  url: string,
  headers: Record<string, string> = {},
): Promise<HealthCheckResult> {
  const startTime = Date.now();
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    });
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
    return {
      isHealthy: false,
      responseTime,
      error: error instanceof Error ? error.message : "Unknown error",
      lastChecked: new Date(),
    };
  }
}
