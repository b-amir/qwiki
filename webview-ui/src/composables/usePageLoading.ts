import { computed, type ComputedRef } from "vue";
import { useNavigationStore, type PageType } from "@/stores/navigation";
import { useLoadingStore } from "@/stores/loading";
import type { LoadingContext } from "@/loading/types";

export interface PageLoadingState {
  showNavigationLoading: ComputedRef<boolean>;
  showPageLoading: ComputedRef<boolean>;
}

/**
 * Composable to determine loading state for a specific page.
 * Provides two mutually exclusive loading states:
 * - showNavigationLoading: true when navigating TO this page
 * - showPageLoading: true when ON this page and page context is active
 */
export function usePageLoading(
  page: PageType,
  pageLoadingContext: LoadingContext,
): PageLoadingState {
  const navigationStore = useNavigationStore();
  const loadingStore = useLoadingStore();

  // Navigation loading: only when navigating TO this page
  const showNavigationLoading = computed(() => {
    return navigationStore.isNavigating && navigationStore.targetPage === page;
  });

  // Page loading: only when ON this page and page context is active
  const showPageLoading = computed(() => {
    return navigationStore.currentPage === page && loadingStore.isActive(pageLoadingContext);
  });

  return {
    showNavigationLoading,
    showPageLoading,
  };
}
