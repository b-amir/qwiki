export class Container {
  private services = new Map<string, any>();
  private factories = new Map<string, () => any>();
  private lazyFactories = new Map<string, () => Promise<any>>();

  register<T>(key: string, factory: () => T): void {
    this.factories.set(key, factory);
  }

  registerInstance<T>(key: string, instance: T): void {
    this.services.set(key, instance);
  }

  registerLazy<T>(key: string, factory: () => Promise<T>): void {
    this.lazyFactories.set(key, factory);
  }

  resolve<T>(key: string): T {
    if (this.services.has(key)) {
      return this.services.get(key);
    }

    const factory = this.factories.get(key);
    if (!factory) {
      throw new Error(`Service ${key} not registered`);
    }

    const instance = factory();
    this.services.set(key, instance);
    return instance;
  }

  async resolveLazy<T>(key: string): Promise<T> {
    if (this.services.has(key)) {
      return this.services.get(key) as T;
    }

    const factory = this.lazyFactories.get(key);
    if (!factory) {
      throw new Error(`Lazy service ${key} not registered`);
    }

    const instance = await factory() as T;
    this.services.set(key, instance);
    return instance;
  }

  has(key: string): boolean {
    return this.services.has(key) || this.factories.has(key) || this.lazyFactories.has(key);
  }

  isLoaded(key: string): boolean {
    return this.services.has(key);
  }
}
