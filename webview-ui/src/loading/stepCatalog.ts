import type { LoadingStepDefinition, KnownLoadingContext } from "./types";

type StepCatalog = Record<KnownLoadingContext, LoadingStepDefinition[]>;

export const stepCatalog: StepCatalog = {
  wiki: [
    { text: "Validating provider configuration...", key: "validating" },
    { text: "Building project context...", key: "buildingContext" },
    { text: "Selecting optimal context...", key: "selectingContext" },
    { text: "Analyzing project structure...", key: "analyzingProject" },
    { text: "Analyzing code structure...", key: "analyzing" },
    { text: "Finding related files...", key: "finding" },
    { text: "Preparing LLM request...", key: "preparing" },
    { text: "Building documentation prompt...", key: "buildingPrompt" },
    { text: "Sending request to LLM...", key: "sendingRequest" },
    { text: "Waiting for LLM response...", key: "waitingForResponse" },
    { text: "Processing response...", key: "processing" },
    { text: "Finalizing documentation...", key: "finalizing" },
  ],
  settings: [
    { text: "Loading settings...", key: "loading" },
    { text: "Fetching providers...", key: "fetching" },
    { text: "Preparing configuration...", key: "preparing" },
  ],
  navigation: [{ text: "Loading page...", key: "loading" }],
  environment: [
    { text: "Preparing Qwiki services...", key: "extensionLoading" },
    { text: "Waiting for language features...", key: "languageServerLoading" },
  ],
  savedWikis: [
    { text: "Loading saved wikis...", key: "loading" },
    { text: "Preparing entries...", key: "preparing" },
  ],
  errorHistory: [
    { text: "Gathering error history...", key: "loading" },
    { text: "Preparing view...", key: "preparing" },
  ],
  readmeUpdate: [
    { text: "Analyzing wikis...", key: "analyzingWikis" },
    { text: "Detecting README state...", key: "detectingReadmeState" },
    { text: "Building prompt...", key: "buildingPrompt" },
    { text: "Generating README...", key: "generatingReadme" },
    { text: "Writing README...", key: "writingReadme" },
  ],
};

export function getStepsForContext(context: KnownLoadingContext) {
  return stepCatalog[context];
}
