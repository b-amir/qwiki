import { computed, type Ref } from "vue";
import type { LoadingViewVariant } from "@/loading/loadingViewConfig";
import { loadingViewConfig } from "@/loading/loadingViewConfig";

export function useLoadingViewStyles(
  variant: Ref<LoadingViewVariant> | LoadingViewVariant,
  distanceFromActive: Ref<number> | number,
) {
  const variantRef =
    typeof variant === "object" && "value" in variant ? variant : computed(() => variant);
  const distanceRef =
    typeof distanceFromActive === "object" && "value" in distanceFromActive
      ? distanceFromActive
      : computed(() => distanceFromActive);

  const config = computed(() => loadingViewConfig[variantRef.value]);

  const containerStyle = computed(() => {
    const style: Record<string, string> = {};
    const distance = Math.abs(distanceRef.value);
    if (distance > 2) {
      const blurAmount = Math.min((distance - 2) * 0.3, 1.5);
      const opacityReduction = Math.max(1 - (distance - 2) * 0.15, 0.3);
      style.filter = `blur(${blurAmount}px)`;
      style.opacity = opacityReduction.toString();
    }
    return style;
  });

  const nodeStyle = computed(() => {
    const baseStyle: Record<string, string> = {};
    return baseStyle;
  });

  const getActiveNodeStyle = (): Record<string, string> => {
    const baseStyle: Record<string, string> = {};
    baseStyle.filter =
      variantRef.value === "full"
        ? "drop-shadow(0 0 10px rgba(139, 92, 246, 0.5))"
        : "drop-shadow(0 0 8px rgba(139, 92, 246, 0.4))";
    return baseStyle;
  };

  const connectorStyle = computed(() => {
    const style: Record<string, string> = {};
    style.opacity = "0.07";
    const distance = Math.abs(distanceRef.value);
    if (distance > 2) {
      const blurAmount = Math.min((distance - 2) * 0.3, 1.5);
      style.filter = `blur(${blurAmount}px)`;
    }
    return style;
  });

  return {
    config,
    containerStyle,
    nodeStyle,
    connectorStyle,
    getActiveNodeStyle,
  };
}
