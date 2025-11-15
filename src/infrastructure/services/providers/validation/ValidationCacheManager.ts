import { createHash } from "crypto";
import { ServiceLimits } from "@/constants/ServiceLimits";
import type { ValidationResult } from "@/infrastructure/services/providers/ProviderValidationService";

interface CachedValidationResult {
  result: ValidationResult;
  timestamp: number;
}

export class ValidationCacheManager {
  private validationCache = new Map<string, CachedValidationResult>();
  private readonly CACHE_TTL_MS = ServiceLimits.apiKeyValidationCacheTTL;

  getCacheKey(providerId: string, apiKey: string): string {
    const apiKeyHash = createHash("sha256").update(apiKey).digest("hex").substring(0, 16);
    return `${providerId}:${apiKeyHash}`;
  }

  getCachedResult(cacheKey: string): ValidationResult | null {
    const cached = this.validationCache.get(cacheKey);
    if (cached && this.isCacheValid(cached)) {
      return cached.result;
    }
    return null;
  }

  setCachedResult(cacheKey: string, result: ValidationResult): void {
    this.validationCache.set(cacheKey, {
      result,
      timestamp: Date.now(),
    });
  }

  invalidateCache(providerId?: string): void {
    if (providerId) {
      const keysToDelete: string[] = [];
      for (const key of this.validationCache.keys()) {
        if (key.startsWith(`${providerId}:`)) {
          keysToDelete.push(key);
        }
      }
      for (const key of keysToDelete) {
        this.validationCache.delete(key);
      }
    } else {
      this.validationCache.clear();
    }
  }

  private isCacheValid(cached: CachedValidationResult): boolean {
    return Date.now() - cached.timestamp < this.CACHE_TTL_MS;
  }
}
