export const LoadingContexts = {
  wiki: "wiki",
  settings: "settings",
  navigation: "navigation",
  environment: "environment",
  savedWikis: "savedWikis",
  errorHistory: "errorHistory",
} as const;

export type LoadingContext = (typeof LoadingContexts)[keyof typeof LoadingContexts];

export const LoadingSteps = {
  validating: "validating",
  buildingContext: "buildingContext",
  selectingContext: "selectingContext",
  analyzingProject: "analyzingProject",
  analyzing: "analyzing",
  finding: "finding",
  preparing: "preparing",
  buildingPrompt: "buildingPrompt",
  sendingRequest: "sendingRequest",
  waitingForResponse: "waitingForResponse",
  processing: "processing",
  finalizing: "finalizing",
  extensionLoading: "extensionLoading",
  languageServerLoading: "languageServerLoading",
  loading: "loading",
} as const;

export type LoadingStep = (typeof LoadingSteps)[keyof typeof LoadingSteps];

export interface LoadingProgressMessage {
  context: LoadingContext;
  step: string;
  percent?: number;
}
