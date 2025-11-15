import { ErrorCodes, type ErrorCode } from "@/errors";
import { ServiceLimits } from "@/constants";

export interface RetryStrategy {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  jitter: boolean;
  retryableCodes: ErrorCode[];
}

export const createRetryStrategies = (): Map<ErrorCode, RetryStrategy> => {
  return new Map<ErrorCode, RetryStrategy>([
    [
      ErrorCodes.NETWORK_ERROR,
      {
        maxAttempts: 3,
        baseDelay: ServiceLimits.baseRetryDelay,
        maxDelay: ServiceLimits.maxRetryDelay,
        jitter: true,
        retryableCodes: [ErrorCodes.NETWORK_ERROR],
      },
    ],
    [
      ErrorCodes.RATE_LIMIT_EXCEEDED,
      {
        maxAttempts: 5,
        baseDelay: ServiceLimits.minRetryDelay,
        maxDelay: ServiceLimits.maxRetryDelay * 2,
        jitter: true,
        retryableCodes: [ErrorCodes.RATE_LIMIT_EXCEEDED],
      },
    ],
    [
      ErrorCodes.GENERATION_FAILED,
      {
        maxAttempts: 2,
        baseDelay: ServiceLimits.baseRetryDelay * 2,
        maxDelay: ServiceLimits.maxRetryDelay,
        jitter: true,
        retryableCodes: [ErrorCodes.GENERATION_FAILED],
      },
    ],
    [
      ErrorCodes.INIT_TIMEOUT,
      {
        maxAttempts: 2,
        baseDelay: ServiceLimits.baseRetryDelay * 3,
        maxDelay: ServiceLimits.maxRetryDelay,
        jitter: true,
        retryableCodes: [ErrorCodes.INIT_TIMEOUT],
      },
    ],
  ]);
};
