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
  // Provider validation
  validatingProvider: "validatingProvider",

  // Context building
  initializingContext: "initializingContext",
  calculatingTokenBudget: "calculatingTokenBudget",
  detectingProjectType: "detectingProjectType",
  analyzingFileRelevance: "analyzingFileRelevance",
  optimizingContextSelection: "optimizingContextSelection",

  // Code analysis
  analyzingSnippet: "analyzingSnippet",
  buildingContextSummary: "buildingContextSummary",
  collectingSemanticInfo: "collectingSemanticInfo",

  // Prompt preparation
  preparingGenerationInput: "preparingGenerationInput",
  buildingPrompt: "buildingPrompt",

  // LLM interaction
  sendingLLMRequest: "sendingLLMRequest",
  waitingForLLMResponse: "waitingForLLMResponse",

  // Response processing
  processingLLMOutput: "processingLLMOutput",
  finalizingDocumentation: "finalizingDocumentation",

  // README specific
  loadingSavedWikis: "loadingSavedWikis",
  detectingReadmeState: "detectingReadmeState",
  creatingBackup: "creatingBackup",
  optimizingWikiSelection: "optimizingWikiSelection",
  buildingReadmePrompt: "buildingReadmePrompt",
  generatingReadmeContent: "generatingReadmeContent",
  writingReadmeFile: "writingReadmeFile",

  // Page loading - Settings
  loadingSettings: "loadingSettings",
  fetchingConfiguration: "fetchingConfiguration",
  renderingSettings: "renderingSettings",

  // Page loading - Saved Wikis
  loadingWikis: "loadingWikis",
  fetchingWikiData: "fetchingWikiData",
  sortingWikis: "sortingWikis",
  renderingWikis: "renderingWikis",

  // Page loading - Error History
  loadingHistory: "loadingHistory",
  fetchingErrors: "fetchingErrors",
  renderingHistory: "renderingHistory",

  // General
  loading: "loading",
  extensionLoading: "extensionLoading",
} as const;

export type LoadingStep = (typeof LoadingSteps)[keyof typeof LoadingSteps];

export interface LoadingProgressMessage {
  context: LoadingContext;
  step: string;
  percent?: number;
}

export function getProgressMessageForStep(step: LoadingStep): string {
  const messageMap: Record<LoadingStep, string> = {
    // Provider validation
    [LoadingSteps.validatingProvider]: "Validating provider...",

    // Context building
    [LoadingSteps.initializingContext]: "Initializing context...",
    [LoadingSteps.calculatingTokenBudget]: "Calculating token budget...",
    [LoadingSteps.detectingProjectType]: "Detecting project type...",
    [LoadingSteps.analyzingFileRelevance]: "Analyzing file relevance...",
    [LoadingSteps.optimizingContextSelection]: "Optimizing context selection...",

    // Code analysis
    [LoadingSteps.analyzingSnippet]: "Analyzing code snippet...",
    [LoadingSteps.buildingContextSummary]: "Building context summary...",
    [LoadingSteps.collectingSemanticInfo]: "Collecting semantic information...",

    // Prompt preparation
    [LoadingSteps.preparingGenerationInput]: "Preparing generation input...",
    [LoadingSteps.buildingPrompt]: "Building prompt...",

    // LLM interaction
    [LoadingSteps.sendingLLMRequest]: "Sending LLM request...",
    [LoadingSteps.waitingForLLMResponse]: "Waiting for LLM response...",

    // Response processing
    [LoadingSteps.processingLLMOutput]: "Processing LLM output...",
    [LoadingSteps.finalizingDocumentation]: "Finalizing documentation...",

    // README specific
    [LoadingSteps.loadingSavedWikis]: "Loading saved wikis...",
    [LoadingSteps.detectingReadmeState]: "Detecting README state...",
    [LoadingSteps.creatingBackup]: "Creating backup...",
    [LoadingSteps.optimizingWikiSelection]: "Optimizing wiki selection...",
    [LoadingSteps.buildingReadmePrompt]: "Building README prompt...",
    [LoadingSteps.generatingReadmeContent]: "Generating README content...",
    [LoadingSteps.writingReadmeFile]: "Writing README file...",

    // Page loading - Settings
    [LoadingSteps.loadingSettings]: "Loading settings...",
    [LoadingSteps.fetchingConfiguration]: "Fetching configuration...",
    [LoadingSteps.renderingSettings]: "Rendering settings...",

    // Page loading - Saved Wikis
    [LoadingSteps.loadingWikis]: "Loading wikis...",
    [LoadingSteps.fetchingWikiData]: "Fetching wiki data...",
    [LoadingSteps.sortingWikis]: "Sorting wikis...",
    [LoadingSteps.renderingWikis]: "Rendering wikis...",

    // Page loading - Error History
    [LoadingSteps.loadingHistory]: "Loading history...",
    [LoadingSteps.fetchingErrors]: "Fetching errors...",
    [LoadingSteps.renderingHistory]: "Rendering history...",

    // General
    [LoadingSteps.loading]: "Loading...",
    [LoadingSteps.extensionLoading]: "Initializing services...",
  };
  return messageMap[step] || "Processing...";
}
