import { computed } from "vue";
import { useLoadingStore } from "@/stores/loading";
import {
  type LoadingContext,
  type LoadingDensity,
  type LoadingStepDefinition,
  isKnownContext,
} from "@/loading/types";
import { getStepsForContext } from "@/loading/stepCatalog";
import { getContextDensity } from "@/loading/config";

type UseLoadingOptions = {
  steps?: LoadingStepDefinition[];
  density?: LoadingDensity;
  timeoutMs?: number | null;
};

export function useLoading(context: LoadingContext, options: UseLoadingOptions = {}) {
  const store = useLoadingStore();

  const state = computed(() => store.getState(context));
  const isActive = computed(() => state.value.active);
  const steps = computed(() => {
    if (options.steps?.length) return options.steps;
    if (isKnownContext(context)) return getStepsForContext(context);
    return [];
  });
  const density = computed(() => {
    if (options.density) return options.density;
    if (isKnownContext(context)) return getContextDensity(context);
    return "medium" as LoadingDensity;
  });

  const start = (step?: string, timeoutMs?: number | null) => {
    store.start({ context, step, timeoutMs: timeoutMs ?? options.timeoutMs ?? undefined });
  };

  const advance = (step: string, percent?: number | null) => {
    store.advance({ context, step, percent });
  };

  const complete = () => store.complete({ context });
  const fail = (error: string) => store.fail({ context, error });
  const cancel = (reason?: string) => store.cancel({ context, reason });
  const reset = () => store.reset(context);

  return {
    state,
    isActive,
    steps,
    density,
    start,
    advance,
    complete,
    fail,
    cancel,
    reset,
    context,
  };
}
