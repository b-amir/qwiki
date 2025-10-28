export const Messages = {
  openFileToCreate: "Open a file to create a Qwiki entry.",
  selectCodeToBuild: "Select some code or add content to the current file to build a wiki.",
  noCodeSelected: "No code selected. Please select some code to generate documentation.",
  cannotResolvePath: (p: string) => `Cannot resolve path to open: ${p}`,
  failedToOpenFile: (m: string) => `Failed to open file: ${m}`,
  generateFailedDefault: "Failed to generate documentation",
} as const;
