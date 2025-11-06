import { computed, type Ref } from "vue";
import type { LoadingViewVariant } from "@/loading/loadingViewConfig";
import { loadingViewConfig } from "@/loading/loadingViewConfig";
import { LoadingViewAnimations } from "@/constants/loadingViewAnimations";

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
    if (distance > 1) {
      const blurAmount = Math.min(
        (distance - 1) * LoadingViewAnimations.blurMultiplier,
        LoadingViewAnimations.maxBlurAmount,
      );
      const opacityReduction = Math.max(
        1 - (distance - 1) * LoadingViewAnimations.opacityReductionMultiplier,
        LoadingViewAnimations.minOpacity,
      );
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
        ? LoadingViewAnimations.dropShadowFull
        : LoadingViewAnimations.dropShadowCompact;
    return baseStyle;
  };

  const connectorStyle = computed(() => {
    const style: Record<string, string> = {};
    style.opacity = LoadingViewAnimations.connectorOpacity.toString();
    const distance = Math.abs(distanceRef.value);
    if (distance > 1) {
      const blurAmount = Math.min(
        (distance - 1) * LoadingViewAnimations.blurMultiplier,
        LoadingViewAnimations.maxBlurAmount,
      );
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
