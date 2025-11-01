import { ProviderError, ErrorCodes } from "../../../errors";

export function handleHttpError(
  response: Response,
  providerId: string,
  providerName: string,
  responseText: string,
): never {
  if (response.status === 401) {
    throw new ProviderError(
      ErrorCodes.API_KEY_INVALID,
      `${providerName} API key is invalid`,
      providerId,
      responseText,
    );
  }
  if (response.status === 429) {
    throw new ProviderError(
      ErrorCodes.RATE_LIMIT_EXCEEDED,
      `${providerName} rate limit exceeded`,
      providerId,
      responseText,
    );
  }
  if (response.status >= 500) {
    throw new ProviderError(
      ErrorCodes.NETWORK_ERROR,
      `${providerName} server error`,
      providerId,
      responseText,
    );
  }
  throw new ProviderError(
    ErrorCodes.GENERATION_FAILED,
    `${providerName} request failed: ${response.status}`,
    providerId,
    responseText,
  );
}

export function handleTimeoutError(
  error: unknown,
  providerId: string,
  providerName: string,
): never {
  if (error instanceof Error && error.name === "AbortError") {
    throw new ProviderError(
      ErrorCodes.NETWORK_ERROR,
      `${providerName} request timed out after 30 seconds`,
      providerId,
      "Request timeout",
    );
  }
  throw error;
}
