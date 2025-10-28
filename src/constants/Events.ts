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
} as const;

export const OutboundEvents = {
  navigate: "navigate",
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
} as const;

export const LoadingSteps = {
  validating: "validating",
  analyzing: "analyzing",
  finding: "finding",
  preparing: "preparing",
  generating: "generating",
  processing: "processing",
  finalizing: "finalizing",
} as const;

export type LoadingStep = (typeof LoadingSteps)[keyof typeof LoadingSteps];

export const Pages = {
  wiki: "wiki",
  settings: "settings",
} as const;

export type Page = (typeof Pages)[keyof typeof Pages];
