export const CommandIds = {
  generateWiki: "generateWiki",
  getSelection: "getSelection",
  getRelated: "getRelated",
  saveApiKey: "saveApiKey",
  getProviders: "getProviders",
  openFile: "openFile",
  saveSetting: "saveSetting",
  deleteApiKey: "deleteApiKey",
  getApiKeys: "getApiKeys",
  getProviderConfigs: "getProviderConfigs",
  getConfiguration: "getConfiguration",
  updateConfiguration: "updateConfiguration",
} as const;

export const VSCodeCommandIds = {
  showPanel: "qwiki.show",
  viewSettings: "qwiki.viewSettings",
  createQuickWiki: "qwiki.createQuickWiki",
  openPanelView: "workbench.view.extension.qwiki",
  wikiViewId: "qwiki.wikiView",
} as const;
