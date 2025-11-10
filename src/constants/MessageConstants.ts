export const MessageTemplates = {
  cannotResolvePath: (path: string) => `Cannot resolve path to open: ${path}`,
  failedToOpenFile: (message: string) => `Failed to open file: ${message}`,
} as const;

export const MessageStrings = {
  openFileToCreate: "Open a file to generate a Qwiki entry.",
  selectCodeToBuild: "Select some code or add content to the current file to build a wiki.",
  noCodeSelected: "No code selected. Please select some code to generate documentation.",
  generateFailedDefault: "Failed to generate documentation",
  retrySavedWikis: "Try again from Saved Wikis",
  checkLogs: "Check extension logs for details",
  package: "package",
  deps: "deps",
  devDeps: "devDeps",
  textMatch: "text match",
  native: "native",
  openaiCompatible: "openai-compatible",
} as const;

export const MessageFormats = {
  dependencies: (deps: string[], hasMore: boolean) => `${deps.join(", ")}${hasMore ? "." : ""}`,
  overview: (parts: string[]) => parts.join("; "),
} as const;
