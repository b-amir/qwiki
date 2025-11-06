import { ref, computed, onMounted, onBeforeUnmount, type Ref } from "vue";

interface VirtualScrollOptions {
  itemHeight: number;
  overscan?: number;
  containerRef: Ref<HTMLElement | null>;
}

interface VirtualScrollItem<T> {
  item: T;
  index: number;
  offset: number;
}

export function useVirtualScrolling<T>(items: Ref<T[]>, options: VirtualScrollOptions) {
  const { itemHeight, overscan = 3, containerRef } = options;

  const scrollTop = ref(0);
  const containerHeight = ref(0);

  const totalHeight = computed(() => items.value.length * itemHeight);

  const visibleRange = computed(() => {
    if (containerHeight.value === 0) {
      return { start: 0, end: 0 };
    }

    const start = Math.floor(scrollTop.value / itemHeight);
    const end = Math.min(
      items.value.length - 1,
      Math.ceil((scrollTop.value + containerHeight.value) / itemHeight),
    );

    return {
      start: Math.max(0, start - overscan),
      end: Math.min(items.value.length - 1, end + overscan),
    };
  });

  const visibleItems = computed((): VirtualScrollItem<T>[] => {
    const range = visibleRange.value;
    const result: VirtualScrollItem<T>[] = [];

    for (let i = range.start; i <= range.end; i++) {
      result.push({
        item: items.value[i],
        index: i,
        offset: i * itemHeight,
      });
    }

    return result;
  });

  const handleScroll = (event: Event) => {
    const target = event.target as HTMLElement;
    scrollTop.value = target.scrollTop;
  };

  const measureContainer = () => {
    if (containerRef.value) {
      containerHeight.value = containerRef.value.clientHeight;
    }
  };

  let resizeObserver: ResizeObserver | null = null;

  onMounted(() => {
    if (containerRef.value) {
      containerRef.value.addEventListener("scroll", handleScroll, { passive: true });
      measureContainer();

      if ("ResizeObserver" in window) {
        resizeObserver = new ResizeObserver(() => {
          measureContainer();
        });
        resizeObserver.observe(containerRef.value);
      }
    }
  });

  onBeforeUnmount(() => {
    if (containerRef.value) {
      containerRef.value.removeEventListener("scroll", handleScroll);
    }
    if (resizeObserver && containerRef.value) {
      resizeObserver.unobserve(containerRef.value);
      resizeObserver = null;
    }
  });

  return {
    visibleItems,
    totalHeight,
    scrollTop,
    containerHeight,
  };
}
