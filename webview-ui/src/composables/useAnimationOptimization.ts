import { ref, onBeforeUnmount, type Ref } from "vue";

export function useWillChange() {
  const elementRef = ref<HTMLElement | null>(null);
  const willChangeProperties = ref<string[]>([]);

  function setWillChange(properties: string[]) {
    if (!elementRef.value) return;
    willChangeProperties.value = properties;
    elementRef.value.style.willChange = properties.join(", ");
  }

  function clearWillChange() {
    if (!elementRef.value) return;
    willChangeProperties.value = [];
    elementRef.value.style.willChange = "auto";
  }

  function addWillChangeProperty(property: string) {
    if (!elementRef.value) return;
    if (!willChangeProperties.value.includes(property)) {
      willChangeProperties.value.push(property);
      elementRef.value.style.willChange = willChangeProperties.value.join(", ");
    }
  }

  function removeWillChangeProperty(property: string) {
    if (!elementRef.value) return;
    willChangeProperties.value = willChangeProperties.value.filter((p) => p !== property);
    if (willChangeProperties.value.length === 0) {
      elementRef.value.style.willChange = "auto";
    } else {
      elementRef.value.style.willChange = willChangeProperties.value.join(", ");
    }
  }

  onBeforeUnmount(() => {
    clearWillChange();
  });

  return {
    elementRef,
    setWillChange,
    clearWillChange,
    addWillChangeProperty,
    removeWillChangeProperty,
  };
}

export function useGPULayer(elementRef: Ref<HTMLElement | null>) {
  function promoteToGPULayer() {
    if (!elementRef.value) return;
    elementRef.value.style.transform = "translateZ(0)";
    elementRef.value.style.backfaceVisibility = "hidden";
  }

  function removeGPULayer() {
    if (!elementRef.value) return;
    elementRef.value.style.transform = "";
    elementRef.value.style.backfaceVisibility = "";
  }

  return {
    promoteToGPULayer,
    removeGPULayer,
  };
}
