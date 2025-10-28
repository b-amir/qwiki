export const Inbound = {
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
} as const;

export const Outbound = {
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
} as const;

export const LoadingStep = {
  validating: "validating",
  analyzing: "analyzing",
  finding: "finding",
  preparing: "preparing",
  generating: "generating",
  processing: "processing",
  finalizing: "finalizing",
} as const;

export type Page = "wiki" | "settings";
