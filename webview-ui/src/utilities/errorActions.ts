import { ErrorCodes } from "./errorMessages";
import type { PageType } from "@/composables/useNavigation";

export interface ErrorAction {
  label: string;
  action: "navigate" | "none" | "external";
  target?: PageType | string;
  condition?: (currentPage: PageType) => boolean;
  handler?: () => void;
}

const ERROR_ACTIONS: Record<string, ErrorAction> = {
  [ErrorCodes.PROVIDER_NOT_FOUND]: {
    label: "Go to Settings",
    action: "navigate",
    target: "settings",
    condition: (currentPage) => currentPage !== "settings",
  },
  [ErrorCodes.API_KEY_MISSING]: {
    label: "Add API Key",
    action: "navigate",
    target: "settings",
    condition: (currentPage) => currentPage !== "settings",
  },
  [ErrorCodes.API_KEY_INVALID]: {
    label: "Update API Key",
    action: "navigate",
    target: "settings",
    condition: (currentPage) => currentPage !== "settings",
  },
  [ErrorCodes.MODEL_NOT_SUPPORTED]: {
    label: "Change Model",
    action: "navigate",
    target: "settings",
    condition: (currentPage) => currentPage !== "settings",
  },
  [ErrorCodes.PROVIDER_NOT_SELECTED]: {
    label: "Select Provider",
    action: "navigate",
    target: "settings",
    condition: (currentPage) => currentPage !== "settings",
  },
  [ErrorCodes.CONFIGURATION_ERROR]: {
    label: "Fix Configuration",
    action: "navigate",
    target: "settings",
    condition: (currentPage) => currentPage !== "settings",
  },
  [ErrorCodes.VALIDATION_ERROR]: {
    label: "Review Settings",
    action: "navigate",
    target: "settings",
    condition: (currentPage) => currentPage !== "settings",
  },
  [ErrorCodes.NETWORK_ERROR]: {
    label: "View Error History",
    action: "navigate",
    target: "errorHistory",
    condition: (currentPage) => currentPage !== "errorHistory",
  },
  [ErrorCodes.RATE_LIMIT_EXCEEDED]: {
    label: "View Error History",
    action: "navigate",
    target: "errorHistory",
    condition: (currentPage) => currentPage !== "errorHistory",
  },
  [ErrorCodes.MISSING_SNIPPET]: {
    label: "Dismiss",
    action: "none",
  },
  [ErrorCodes.INIT_TIMEOUT]: {
    label: "Dismiss",
    action: "none",
  },
  [ErrorCodes.GENERATION_FAILED]: {
    label: "Try Different Provider",
    action: "navigate",
    target: "settings",
    condition: (currentPage) => currentPage !== "settings",
  },
};

export function getErrorAction(errorCode?: string, currentPage?: PageType): ErrorAction | null {
  if (!errorCode) return null;

  const action = ERROR_ACTIONS[errorCode];
  if (!action) return null;

  if (action.condition && currentPage && !action.condition(currentPage)) {
    return null;
  }

  return action;
}
