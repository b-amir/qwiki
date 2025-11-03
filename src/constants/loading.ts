export const LoadingContexts = {
  wiki: "wiki",
  settings: "settings",
  navigation: "navigation",
  environment: "environment",
  savedWikis: "savedWikis",
  errorHistory: "errorHistory",
  readmeUpdate: "readmeUpdate",
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
  analyzingWikis: "analyzingWikis",
  detectingReadmeState: "detectingReadmeState",
  optimizingSelection: "optimizingSelection",
  preparingLLMRequest: "preparingLLMRequest",
  generatingReadme: "generatingReadme",
  processingResponse: "processingResponse",
  writingReadme: "writingReadme",
} as const;

export type LoadingStep = (typeof LoadingSteps)[keyof typeof LoadingSteps];

export interface LoadingProgressMessage {
  context: LoadingContext;
  step: string;
  percent?: number;
}

export function getProgressMessageForStep(step: LoadingStep): string {
  const messageMap: Record<LoadingStep, string> = {
    [LoadingSteps.validating]: "Validating provider configuration...",
    [LoadingSteps.buildingContext]: "Building project context...",
    [LoadingSteps.selectingContext]: "Selecting optimal context...",
    [LoadingSteps.analyzingProject]: "Analyzing project structure...",
    [LoadingSteps.analyzing]: "Analyzing code structure...",
    [LoadingSteps.finding]: "Finding related files...",
    [LoadingSteps.preparing]: "Preparing LLM request...",
    [LoadingSteps.buildingPrompt]: "Building documentation prompt...",
    [LoadingSteps.sendingRequest]: "Sending request to LLM...",
    [LoadingSteps.waitingForResponse]: "Waiting for LLM response...",
    [LoadingSteps.processing]: "Processing response...",
    [LoadingSteps.finalizing]: "Finalizing documentation...",
    [LoadingSteps.extensionLoading]: "Preparing Qwiki services...",
    [LoadingSteps.languageServerLoading]: "Waiting for language features...",
    [LoadingSteps.loading]: "Loading...",
    [LoadingSteps.analyzingWikis]: "Analyzing wikis...",
    [LoadingSteps.detectingReadmeState]: "Detecting README state...",
    [LoadingSteps.optimizingSelection]: "Optimizing wiki selection...",
    [LoadingSteps.preparingLLMRequest]: "Preparing LLM request...",
    [LoadingSteps.generatingReadme]: "Generating README...",
    [LoadingSteps.processingResponse]: "Processing response...",
    [LoadingSteps.writingReadme]: "Writing README...",
  };
  return messageMap[step] || "Processing...";
}
