import type { LoadingStepDefinition, KnownLoadingContext } from "./types";

type StepCatalog = Record<KnownLoadingContext, LoadingStepDefinition[]>;

export const stepCatalog: StepCatalog = {
  wiki: [
    { text: "Validating provider", key: "validatingProvider" },
    { text: "Initializing context", key: "initializingContext" },
    { text: "Calculating token budget", key: "calculatingTokenBudget" },
    { text: "Detecting project type", key: "detectingProjectType" },
    { text: "Analyzing file relevance", key: "analyzingFileRelevance" },
    { text: "Optimizing context", key: "optimizingContextSelection" },
    { text: "Analyzing code", key: "analyzingSnippet" },
    { text: "Building context", key: "buildingContextSummary" },
    { text: "Collecting semantic info", key: "collectingSemanticInfo" },
    { text: "Preparing prompt", key: "preparingGenerationInput" },
    { text: "Building prompt", key: "buildingPrompt" },
    { text: "Sending request", key: "sendingLLMRequest" },
    { text: "Waiting for response", key: "waitingForLLMResponse" },
    { text: "Processing output", key: "processingLLMOutput" },
    { text: "Finalizing", key: "finalizingDocumentation" },
  ],
  settings: [
    { text: "Loading settings", key: "loadingSettings" },
    { text: "Fetching configuration", key: "fetchingConfiguration" },
    { text: "Rendering", key: "renderingSettings" },
  ],
  navigation: [{ text: "Loading page", key: "loading" }],
  environment: [
    { text: "Initializing extension", key: "extensionLoading" },
    { text: "Starting language server", key: "languageServerLoading" },
  ],
  savedWikis: [
    { text: "Loading wikis", key: "loadingWikis" },
    { text: "Fetching data", key: "fetchingWikiData" },
    { text: "Sorting wikis", key: "sortingWikis" },
    { text: "Rendering", key: "renderingWikis" },
  ],
  errorHistory: [
    { text: "Loading history", key: "loadingHistory" },
    { text: "Fetching errors", key: "fetchingErrors" },
    { text: "Rendering", key: "renderingHistory" },
  ],
  readmeUpdate: [
    { text: "Loading wikis", key: "loadingSavedWikis" },
    { text: "Detecting README state", key: "detectingReadmeState" },
    { text: "Creating backup", key: "creatingBackup" },
    { text: "Optimizing selection", key: "optimizingWikiSelection" },
    { text: "Building prompt", key: "buildingReadmePrompt" },
    { text: "Generating content", key: "generatingReadmeContent" },
    { text: "Writing file", key: "writingReadmeFile" },
  ],
};

export function getStepsForContext(context: KnownLoadingContext) {
  return stepCatalog[context];
}
