import { ErrorCodes } from "@/errors/ErrorCodes";

export const ErrorMessages = {
  [ErrorCodes.PROVIDER_NOT_FOUND]: {
    message: "The specified provider could not be found.",
    suggestion:
      "Please check that the provider name is correct and available in your configuration.",
  },
  [ErrorCodes.API_KEY_MISSING]: {
    message: "API key is missing for {providerName}.",
    suggestion:
      "Please add your API key in the settings panel or configuration file for {providerName}.",
  },
  [ErrorCodes.API_KEY_INVALID]: {
    message: "The API key for {providerName} is invalid or has expired.",
    suggestion: "Please verify your API key for {providerName} and update it in the settings.",
  },
  [ErrorCodes.MODEL_NOT_SUPPORTED]: {
    message: 'The model "{modelName}" is not supported by {providerName}.',
    suggestion: "Please choose a supported model from the available options for {providerName}.",
  },
  [ErrorCodes.NETWORK_ERROR]: {
    message: "Network connection failed while contacting {providerName}.",
    suggestion:
      "Please check your internet connection and try again. If the problem persists, the provider may be experiencing issues.",
  },
  [ErrorCodes.RATE_LIMIT_EXCEEDED]: {
    message: "Rate limit exceeded for {providerName}.",
    suggestion:
      "Please wait a moment before making another request, or consider upgrading your {providerName} plan for higher limits.",
  },
  [ErrorCodes.GENERATION_FAILED]: {
    message: "Documentation generation failed with {providerName}.",
    suggestion:
      "Please try again with a different provider or check if your code selection is valid. You can also try with a smaller code snippet.",
  },
  [ErrorCodes.GENERATION_CANCELLED]: {
    message: "Documentation generation was cancelled.",
    suggestion: "You can start a new generation when ready.",
  },
  [ErrorCodes.VALIDATION_ERROR]: {
    message: "Invalid configuration detected for {providerName}.",
    suggestion:
      "Please review your {providerName} configuration settings and correct any invalid values.",
  },
  [ErrorCodes.CONFIGURATION_ERROR]: {
    message: "Configuration error occurred.",
    suggestion:
      "Please check your configuration settings and ensure all required fields are properly filled.",
  },
  [ErrorCodes.PROVIDER_NOT_SELECTED]: {
    message: "No provider selected. Please configure and select a provider in settings.",
    suggestion:
      "Go to Settings and select a provider from the available options. If no providers are available, you may need to configure one with an API key.",
  },
  [ErrorCodes.MISSING_SNIPPET]: {
    message: "No selection. Select some code or text.",
    suggestion:
      "Select some code or text in your editor before generating documentation. You can select code blocks, functions, classes, or any text you want to document.",
  },
  [ErrorCodes.INIT_TIMEOUT]: {
    message: "Initialization timeout. Please try again.",
    suggestion:
      "The extension is taking longer than expected to initialize. Try refreshing the webview or restarting VS Code. Check if there are any network connectivity issues.",
  },
};

export function getErrorMessage(
  errorCode: string,
  providerName?: string,
  modelName?: string,
): { message: string; suggestion: string } {
  const errorTemplate = ErrorMessages[errorCode as keyof typeof ErrorMessages];

  if (!errorTemplate) {
    return {
      message: `An unknown error occurred: ${errorCode}`,
      suggestion: "Please try again or contact support if the problem persists.",
    };
  }

  let message = errorTemplate.message;
  let suggestion = errorTemplate.suggestion;

  if (providerName) {
    message = message.replace("{providerName}", providerName);
    suggestion = suggestion.replace(/{providerName}/g, providerName);
  }

  if (modelName) {
    message = message.replace("{modelName}", modelName);
  }

  return { message, suggestion };
}
