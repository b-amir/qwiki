import { ref, watch, type Ref } from "vue";

export function useDebouncedRef<T>(source: Ref<T>, delay: number = 300): Ref<T> {
  const debounced = ref(source.value) as Ref<T>;

  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  watch(
    source,
    (newValue) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        debounced.value = newValue;
        timeoutId = null;
      }, delay);
    },
    { immediate: true },
  );

  return debounced;
}
