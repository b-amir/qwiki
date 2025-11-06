import { ref, onMounted, onBeforeUnmount, nextTick } from "vue";

export function useStepTracking() {
  const wrapperEl = ref<HTMLElement | null>(null);
  const viewportEl = ref<HTMLElement | null>(null);
  const rowRefs = ref<HTMLElement[]>([]);
  const viewportHeight = ref(0);
  const rowHeight = ref(32);
  const rowGap = 8;

  let resizeObserver: ResizeObserver | null = null;

  function measure() {
    viewportHeight.value = viewportEl.value?.clientHeight ?? wrapperEl.value?.clientHeight ?? 0;
    const firstRow = rowRefs.value[0];
    if (firstRow) {
      rowHeight.value = firstRow.offsetHeight || rowHeight.value;
    }
  }

  onMounted(async () => {
    await nextTick();
    measure();
    if (wrapperEl.value && "ResizeObserver" in window) {
      resizeObserver = new ResizeObserver(() => measure());
      resizeObserver.observe(wrapperEl.value);
    }
  });

  onBeforeUnmount(() => {
    if (resizeObserver && wrapperEl.value) {
      resizeObserver.unobserve(wrapperEl.value);
    }
    resizeObserver = null;
  });

  function triggerMeasure() {
    nextTick(() => measure());
  }

  return {
    wrapperEl,
    viewportEl,
    rowRefs,
    viewportHeight,
    rowHeight,
    rowGap,
    triggerMeasure,
  };
}
