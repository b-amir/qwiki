type FunctionConstraint = {
  (...args: never[]): unknown;
};

export interface DebouncedFunction<T extends FunctionConstraint> {
  (...args: Parameters<T>): void;
  cancel(): void;
  flush(): ReturnType<T> | undefined;
  pending(): boolean;
}

export class DebouncingService {
  private debouncedFunctions = new Map<string, NodeJS.Timeout>();
  private functionArgs = new Map<string, unknown[]>();
  private defaultDelay = 300;

  debounce<T extends FunctionConstraint>(
    func: T,
    delay: number = this.defaultDelay,
    options: {
      leading?: boolean;
      trailing?: boolean;
      maxWait?: number;
      id?: string;
    } = {},
  ): DebouncedFunction<T> {
    const { leading = false, trailing = true, maxWait, id } = options;
    const functionId = id || this.generateFunctionId();

    let timeoutId: NodeJS.Timeout | null = null;
    let maxTimeoutId: NodeJS.Timeout | null = null;
    let lastCallTime = 0;
    let lastInvokeTime = 0;
    let lastArgs: Parameters<T> | undefined;
    let result: ReturnType<T> | undefined;
    let isInvoking = false;

    const invokeFunc = (time: number): ReturnType<T> => {
      const args = lastArgs || ([] as unknown as Parameters<T>);
      lastArgs = undefined;
      lastInvokeTime = time;
      const funcResult = func(...(args as Parameters<T>)) as ReturnType<T>;
      result = funcResult;
      return funcResult;
    };

    const leadingEdge = (time: number): void => {
      lastInvokeTime = time;
      timeoutId = setTimeout(timerExpired, delay);
      if (leading) {
        isInvoking = true;
        result = invokeFunc(time);
      }
    };

    const remainingWait = (time: number): number => {
      const timeSinceLastCall = time - lastCallTime;
      const timeSinceLastInvoke = time - lastInvokeTime;
      const timeWaiting = delay - timeSinceLastCall;

      return maxWait !== undefined
        ? Math.min(timeWaiting, maxWait - timeSinceLastInvoke)
        : timeWaiting;
    };

    const shouldInvoke = (time: number): boolean => {
      const timeSinceLastCall = time - lastCallTime;
      const timeSinceLastInvoke = time - lastInvokeTime;

      return (
        lastCallTime === 0 ||
        timeSinceLastCall >= delay ||
        timeSinceLastCall < 0 ||
        (maxWait !== undefined && timeSinceLastInvoke >= maxWait)
      );
    };

    const timerExpired = (): void => {
      const time = Date.now();
      if (shouldInvoke(time)) {
        trailingEdge(time);
      } else {
        timeoutId = setTimeout(timerExpired, remainingWait(time));
      }
    };

    const trailingEdge = (time: number): void => {
      timeoutId = null;
      if (trailing && lastArgs) {
        isInvoking = true;
        result = invokeFunc(time);
      }
      lastArgs = undefined;
      isInvoking = false;
    };

    const cancel = (): void => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (maxTimeoutId) {
        clearTimeout(maxTimeoutId);
        maxTimeoutId = null;
      }
      lastInvokeTime = 0;
      lastArgs = undefined;
      lastCallTime = 0;
      isInvoking = false;
      this.debouncedFunctions.delete(functionId);
      this.functionArgs.delete(functionId);
    };

    const flush = (): ReturnType<T> | undefined => {
      if (timeoutId === null) {
        return result as ReturnType<T> | undefined;
      }
      const time = Date.now();
      const invokeResult = invokeFunc(time);
      cancel();
      return invokeResult;
    };

    const pending = (): boolean => {
      return timeoutId !== null || isInvoking;
    };

    const debouncedFn = ((...args: Parameters<T>) => {
      const time = Date.now();
      const isInvokingNow = shouldInvoke(time);

      lastArgs = args;
      lastCallTime = time;
      this.functionArgs.set(functionId, args);

      if (isInvokingNow) {
        if (timeoutId === null) {
          leadingEdge(lastCallTime);
        }
        if (maxWait !== undefined) {
          timeoutId = setTimeout(timerExpired, delay);
          maxTimeoutId = setTimeout(() => {
            if (timeoutId) {
              trailingEdge(Date.now());
            }
          }, maxWait);
        }
        return;
      }

      if (timeoutId === null) {
        timeoutId = setTimeout(timerExpired, delay);
      }

      this.debouncedFunctions.set(functionId, timeoutId);
    }) as DebouncedFunction<T>;

    debouncedFn.cancel = cancel;
    debouncedFn.flush = flush;
    debouncedFn.pending = pending;

    return debouncedFn;
  }

  cancel<T extends (...args: never[]) => unknown>(debouncedFunc: DebouncedFunction<T>): void {
    debouncedFunc.cancel();
  }

  flush<T extends (...args: never[]) => unknown>(debouncedFunc: DebouncedFunction<T>): void {
    debouncedFunc.flush();
  }

  configureDefaults(defaultDelay: number): void {
    this.defaultDelay = defaultDelay;
  }

  cancelAll(): void {
    for (const timeoutId of this.debouncedFunctions.values()) {
      clearTimeout(timeoutId);
    }
    this.debouncedFunctions.clear();
    this.functionArgs.clear();
  }

  getActiveDebouncesCount(): number {
    return this.debouncedFunctions.size;
  }

  getDebounceFunctionArgs(id: string): unknown[] | undefined {
    return this.functionArgs.get(id);
  }

  private generateFunctionId(): string {
    return `debounce_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
