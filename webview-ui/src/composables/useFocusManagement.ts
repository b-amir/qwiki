import { nextTick, type Ref } from "vue";

export function useFocusManagement() {
  const focusableSelectors = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "[tabindex]:not([tabindex='-1'])",
  ].join(", ");

  const getFocusableElements = (container: HTMLElement): HTMLElement[] => {
    return Array.from(container.querySelectorAll(focusableSelectors)) as HTMLElement[];
  };

  const focusFirst = async (container: HTMLElement | Ref<HTMLElement | null>) => {
    await nextTick();
    const element = container instanceof HTMLElement ? container : container.value;
    if (!element) return;

    const focusable = getFocusableElements(element);
    if (focusable.length > 0) {
      focusable[0].focus();
    }
  };

  const focusLast = async (container: HTMLElement | Ref<HTMLElement | null>) => {
    await nextTick();
    const element = container instanceof HTMLElement ? container : container.value;
    if (!element) return;

    const focusable = getFocusableElements(element);
    if (focusable.length > 0) {
      focusable[focusable.length - 1].focus();
    }
  };

  const trapFocus = (container: HTMLElement | Ref<HTMLElement | null>) => {
    const element = container instanceof HTMLElement ? container : container.value;
    if (!element) return () => {};

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;

      const focusable = getFocusableElements(element);
      if (focusable.length === 0) return;

      const firstElement = focusable[0];
      const lastElement = focusable[focusable.length - 1];
      const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);

      if (event.shiftKey) {
        if (currentIndex === 0 || currentIndex === -1) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        if (currentIndex === focusable.length - 1 || currentIndex === -1) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    };

    element.addEventListener("keydown", handleKeyDown);
    return () => {
      element.removeEventListener("keydown", handleKeyDown);
    };
  };

  return {
    getFocusableElements,
    focusFirst,
    focusLast,
    trapFocus,
  };
}
