export type LoadingViewVariant = "full" | "compact";

export interface LoadingViewVariantConfig {
  nodeSize: number;
  containerGap: {
    base: string;
    sm: string;
  };
  containerPaddingBottom: {
    base: string;
    sm: string;
  };
  connectorWidth: string;
  connectorTop: string;
  spinnerScale: number;
  textSizes: {
    active: {
      base: string;
      sm: string;
    };
    inactive: {
      base: string;
    };
  };
  easing: string;
  duration: {
    base: number;
    connector: number;
  };
}

export const loadingViewConfig: Record<LoadingViewVariant, LoadingViewVariantConfig> = {
  full: {
    nodeSize: 14,
    containerGap: {
      base: "gap-3",
      sm: "sm:gap-3.5",
    },
    containerPaddingBottom: {
      base: "pb-4",
      sm: "sm:pb-5",
    },
    connectorWidth: "w-[2px]",
    connectorTop: "16px",
    spinnerScale: 0.58,
    textSizes: {
      active: {
        base: "text-sm",
        sm: "sm:text-base sm:leading-normal",
      },
      inactive: {
        base: "text-[0.6875rem]",
      },
    },
    easing: "ease-[cubic-bezier(0.34,1.56,0.64,1)]",
    duration: {
      base: 500,
      connector: 700,
    },
  },
  compact: {
    nodeSize: 12,
    containerGap: {
      base: "gap-2",
      sm: "",
    },
    containerPaddingBottom: {
      base: "py-2",
      sm: "",
    },
    connectorWidth: "w-[1.5px]",
    connectorTop: "14px",
    spinnerScale: 0.42,
    textSizes: {
      active: {
        base: "text-xs",
        sm: "",
      },
      inactive: {
        base: "text-[0.625rem]",
      },
    },
    easing: "ease-out",
    duration: {
      base: 500,
      connector: 700,
    },
  },
};
