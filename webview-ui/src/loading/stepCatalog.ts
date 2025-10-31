import type { LoadingStepDefinition, KnownLoadingContext } from "./types";

type StepCatalog = Record<KnownLoadingContext, LoadingStepDefinition[]>;

export const stepCatalog: StepCatalog = {
  wiki: [
    { text: "Validating selection...", key: "validating" },
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
  navigation: [
    { text: "Loading page...", key: "loading" },
    { text: "Preparing view...", key: "preparing" },
  ],
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
};

export function getStepsForContext(context: KnownLoadingContext) {
  return stepCatalog[context];
}
