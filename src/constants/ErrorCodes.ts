export const ErrorCodes = {
  unknown: "error.unknown",
  generationFailed: "error.generationFailed",
  invalidSelection: "error.invalidSelection",
  missingSnippet: "error.missingSnippet",
  missingProvider: "error.missingProvider",
  invalidConfiguration: "error.invalidConfiguration",
  missingCommand: "error.missingCommand",
} as const;

export const ErrorMessages = {
  [ErrorCodes.unknown]: "Unknown error",
  [ErrorCodes.generationFailed]: "Generation failed",
  [ErrorCodes.invalidSelection]: "Invalid selection",
  [ErrorCodes.missingSnippet]: "No code selected",
  [ErrorCodes.missingProvider]: "Provider not available",
  [ErrorCodes.invalidConfiguration]: "Invalid configuration",
  [ErrorCodes.missingCommand]: "Command not found",
} as const;
