import type { ProviderMetadata } from "@/llm/types/ProviderMetadata";
import type { LLMProvider } from "@/llm/types";
import type { Logger } from "@/infrastructure/services";

export class ProviderLoader {
  constructor(private logger: Logger) {}

  async loadProviderFromMetadata(metadata: ProviderMetadata): Promise<LLMProvider | null> {
    const loadStartTime = Date.now();
    this.logger.debug(`Loading provider ${metadata.id} from ${metadata.entryPoint}`);

    try {
      const importStartTime = Date.now();
      const providerModule = await import(metadata.entryPoint);
      const importEndTime = Date.now();
      this.logger.debug(`Module import completed in ${importEndTime - importStartTime}ms`);

      const ProviderClass = providerModule.default || providerModule[metadata.id];

      if (!ProviderClass) {
        const error = new Error(`Provider class not found in ${metadata.entryPoint}`);
        this.logger.error(`${error.message}`);
        throw error;
      }

      const instantiateStartTime = Date.now();
      const provider = new ProviderClass() as LLMProvider;
      const instantiateEndTime = Date.now();

      const loadEndTime = Date.now();
      this.logger.debug(
        `Provider ${metadata.id} loaded successfully in ${loadEndTime - loadStartTime}ms (instantiate: ${instantiateEndTime - instantiateStartTime}ms)`,
      );

      return provider;
    } catch (error) {
      const loadEndTime = Date.now();
      this.logger.error(
        `Failed to load provider ${metadata.id} after ${loadEndTime - loadStartTime}ms:`,
        error,
      );
      return null;
    }
  }
}
