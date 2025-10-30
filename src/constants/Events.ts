export const InboundEvents = {
  webviewReady: "webviewReady",
  getSelection: "getSelection",
  getRelated: "getRelated",
  openFile: "openFile",
  saveApiKey: "saveApiKey",
  deleteApiKey: "deleteApiKey",
  getProviders: "getProviders",
  getProviderConfigs: "getProviderConfigs",
  getApiKeys: "getApiKeys",
  generateWiki: "generateWiki",
  saveSetting: "saveSetting",
  saveWiki: "saveWiki",
  getSavedWikis: "getSavedWikis",
  deleteWiki: "deleteWiki",
} as const;

export const OutboundEvents = {
  navigate: "navigate",
  webviewReady: "webviewReady",
  selection: "selection",
  triggerGenerate: "triggerGenerate",
  loadingStep: "loadingStep",
  wikiResult: "wikiResult",
  error: "error",
  related: "related",
  apiKeySaved: "apiKeySaved",
  apiKeyDeleted: "apiKeyDeleted",
  providers: "providers",
  providerConfigs: "providerConfigs",
  apiKeys: "apiKeys",
  settingSaved: "settingSaved",
  wikiSaved: "wikiSaved",
  savedWikisLoaded: "savedWikisLoaded",
  wikiDeleted: "wikiDeleted",
  showNotification: "showNotification",
} as const;

export const LoadingSteps = {
  validating: "validating",
  analyzing: "analyzing",
  finding: "finding",
  preparing: "preparing",
  buildingPrompt: "buildingPrompt",
  sendingRequest: "sendingRequest",
  waitingForResponse: "waitingForResponse",
  processing: "processing",
  finalizing: "finalizing",
} as const;

export type LoadingStep = (typeof LoadingSteps)[keyof typeof LoadingSteps];

export const ErrorEvents = {
  occurred: "error.occurred",
  recoveryAttempt: "error.recoveryAttempt",
  recoverySuccess: "error.recoverySuccess",
  recoveryFailed: "error.recoveryFailed",
} as const;

export const Pages = {
  wiki: "wiki",
  settings: "settings",
  savedWikis: "savedWikis",
  errorHistory: "errorHistory",
} as const;

export type Page = (typeof Pages)[keyof typeof Pages];
