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
  updateReadme: "updateReadme",
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
  readmeUpdated: "readmeUpdated",
  readmeBackupCreated: "readmeBackupCreated",
  readmeBackupDeleted: "readmeBackupDeleted",
  readmeBackupState: "readmeBackupState",
  readmeUpdateProgress: "readmeUpdateProgress",
  generationCancelled: "generationCancelled",
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
} as const;

export type Page = (typeof Pages)[keyof typeof Pages];
