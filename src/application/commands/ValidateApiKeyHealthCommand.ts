import type { Command } from "./Command";
import type { LLMRegistry } from "../../llm";
import { MessageBusService } from "../services/MessageBusService";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "../../infrastructure/services/LoggingService";
import type { HealthCheckResult } from "../../llm/types/ProviderCapabilities";

export interface ValidateApiKeyHealthPayload {
  providerId: string;
  apiKey: string;
}

export class ValidateApiKeyHealthCommand implements Command<ValidateApiKeyHealthPayload> {
  private logger: Logger;

  constructor(
    private llmRegistry: LLMRegistry,
    private messageBus: MessageBusService,
    private loggingService: LoggingService,
  ) {
    this.logger = createLogger("ValidateApiKeyHealthCommand", loggingService);
  }

  async execute(payload: ValidateApiKeyHealthPayload): Promise<void> {
    const { providerId, apiKey } = payload;

    this.logger.debug("Validating API key health", { providerId });

    if (!providerId || !apiKey) {
      this.messageBus.postSuccess("apiKeyHealthValidated", {
        providerId,
        isValid: false,
        isHealthy: false,
        error: "Provider ID and API key are required",
        errorCode: "API_KEY_MISSING",
      });
      return;
    }

    // Validate API key format - check for non-ASCII characters
    const hasNonAscii = /[^\x00-\x7F]/.test(apiKey);
    if (hasNonAscii) {
      this.logger.warn("API key contains non-ASCII characters", { providerId });
      this.messageBus.postSuccess("apiKeyHealthValidated", {
        providerId,
        isValid: false,
        isHealthy: false,
        error:
          "API key contains invalid characters. API keys should only contain standard ASCII characters (letters, numbers, and basic symbols).",
        errorCode: "API_KEY_INVALID_FORMAT",
      });
      return;
    }

    // Validate API key length (most API keys are at least 20 characters)
    if (apiKey.trim().length < 10) {
      this.logger.warn("API key is too short", { providerId, length: apiKey.trim().length });
      this.messageBus.postSuccess("apiKeyHealthValidated", {
        providerId,
        isValid: false,
        isHealthy: false,
        error: "API key is too short. Please check that you've entered the complete API key.",
        errorCode: "API_KEY_TOO_SHORT",
      });
      return;
    }

    const startTime = Date.now();

    try {
      const provider = this.llmRegistry.getProvider(providerId as any);
      if (!provider) {
        this.logger.warn("Provider not found", { providerId });
        this.messageBus.postSuccess("apiKeyHealthValidated", {
          providerId,
          isValid: false,
          isHealthy: false,
          error: `Provider ${providerId} not found`,
        });
        return;
      }

      const maybeWithKey = (provider as any).healthCheckWithKey as
        | ((apiKey?: string) => Promise<HealthCheckResult>)
        | undefined;

      if (!maybeWithKey) {
        this.logger.debug("Provider does not support healthCheckWithKey", { providerId });
        this.messageBus.postSuccess("apiKeyHealthValidated", {
          providerId,
          isValid: true,
          isHealthy: true,
          error: undefined,
          responseTime: Date.now() - startTime,
        });
        return;
      }

      const timeoutPromise = new Promise<HealthCheckResult>((_, reject) => {
        setTimeout(() => {
          reject(new Error("Health check timed out after 30 seconds"));
        }, 30000);
      });

      const healthCheckPromise = this.llmRegistry.healthCheckProviderWithKey(
        providerId as any,
        apiKey,
      );

      const result = await Promise.race([healthCheckPromise, timeoutPromise]);

      const responseTime = Date.now() - startTime;

      if (typeof result.responseTime !== "number") {
        result.responseTime = responseTime;
      }
      if (!result.lastChecked) {
        result.lastChecked = new Date();
      }

      this.logger.debug("Health check completed", {
        providerId,
        isHealthy: result.isHealthy,
        responseTime: result.responseTime,
        error: result.error,
      });

      let errorCode: string | undefined;
      if (!result.isHealthy && result.error) {
        const errorMsg = result.error.toLowerCase();
        if (errorMsg.includes("400") || errorMsg.includes("401") || errorMsg.includes("403")) {
          errorCode = "API_KEY_INVALID";
        }
      }

      this.messageBus.postSuccess("apiKeyHealthValidated", {
        providerId,
        isValid: result.isHealthy,
        isHealthy: result.isHealthy,
        responseTime: result.responseTime,
        error: result.error,
        errorCode,
      });
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.logger.error("Health check failed", {
        providerId,
        error: errorMessage,
        responseTime,
      });

      let errorCode = "API_KEY_HEALTH_CHECK_FAILED";
      if (errorMessage.includes("timeout") || errorMessage.includes("timed out")) {
        errorCode = "API_KEY_HEALTH_CHECK_TIMEOUT";
      } else if (
        errorMessage.includes("400") ||
        errorMessage.includes("401") ||
        errorMessage.includes("403") ||
        errorMessage.includes("unauthorized") ||
        errorMessage.includes("invalid") ||
        errorMessage.includes("authentication")
      ) {
        errorCode = "API_KEY_INVALID";
      }

      this.messageBus.postSuccess("apiKeyHealthValidated", {
        providerId,
        isValid: false,
        isHealthy: false,
        responseTime,
        error: errorMessage,
        errorCode,
      });
    }
  }
}
