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
  getEnvironmentStatus: "getEnvironmentStatus",
  createAggregation: "createAggregation",
  updateReadme: "updateReadme",
  previewReadmeUpdate: "previewReadmeUpdate",
  getAggregations: "getAggregations",
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
  providerCapabilitiesRetrieved: "providerCapabilitiesRetrieved",
  apiKeys: "apiKeys",
  settingSaved: "settingSaved",
  wikiSaved: "wikiSaved",
  savedWikisLoaded: "savedWikisLoaded",
  wikiDeleted: "wikiDeleted",
  showNotification: "showNotification",
  environmentStatus: "environmentStatus",
  aggregationCreated: "aggregationCreated",
  readmeUpdated: "readmeUpdated",
  readmePreviewGenerated: "readmePreviewGenerated",
  aggregationsLoaded: "aggregationsLoaded",
  currentReadmeLoaded: "currentReadmeLoaded",
  readmeBackedUp: "readmeBackedUp",
  readmeRestored: "readmeRestored",
} as const;

export { LoadingSteps } from "./loading";
export type { LoadingStep } from "./loading";

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
  wikiAggregation: "wikiAggregation",
  readmeUpdate: "readmeUpdate",
} as const;

export type Page = (typeof Pages)[keyof typeof Pages];
