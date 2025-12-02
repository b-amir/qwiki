import { ErrorCodes } from "@/errors";
import type { ErrorCode } from "@/errors";

export interface ErrorContext {
  operation: string;
  userMessage: string;
  suggestions: string[];
  data: Record<string, unknown>;
  timestamp: number;
  originalError?: Error;
}

export class ErrorContextBuilder {
  static build(
    operation: string,
    error: Error,
    additionalData?: Record<string, unknown>,
  ): ErrorContext {
    return {
      operation,
      userMessage: this.getUserMessage(error),
      suggestions: this.getSuggestions(error, operation),
      data: {
        ...additionalData,
        errorMessage: error.message,
        errorName: error.name,
      },
      timestamp: Date.now(),
      originalError: error,
    };
  }

  private static getUserMessage(error: Error): string {
    const message = error.message.toLowerCase();

    if (message.includes("timeout") || message.includes("timed out")) {
      return "The operation took too long. Please try again.";
    }

    if (message.includes("network") || message.includes("connection")) {
      return "Network error occurred. Check your connection.";
    }

    if (message.includes("api key") || message.includes("authentication")) {
      return "Authentication failed. Please check your API key configuration.";
    }

    if (message.includes("rate limit")) {
      return "Rate limit exceeded. Please wait a moment before trying again.";
    }

    if (message.includes("quota") || message.includes("billing")) {
      return "Service quota exceeded. Please check your account limits.";
    }

    if (message.includes("invalid") || message.includes("validation")) {
      return "Invalid input provided. Please check your request.";
    }

    if (message.includes("not found") || message.includes("404")) {
      return "Resource not found. Please verify the request.";
    }

    if (message.includes("permission") || message.includes("unauthorized")) {
      return "Permission denied. Please check your access rights.";
    }

    return "An error occurred. Please try again.";
  }

  private static getSuggestions(error: Error, operation: string): string[] {
    const suggestions: string[] = [];
    const message = error.message.toLowerCase();
    const errorCode = this.extractErrorCode(error);

    if (message.includes("timeout") || message.includes("timed out")) {
      suggestions.push("Try reducing the amount of context");
      suggestions.push("Check your internet connection");
      suggestions.push("Try again in a few moments");
    }

    if (message.includes("network") || message.includes("connection")) {
      suggestions.push("Check your internet connection");
      suggestions.push("Verify firewall settings");
      suggestions.push("Try again in a few moments");
    }

    if (message.includes("api key") || errorCode === ErrorCodes.API_KEY_MISSING) {
      suggestions.push("Verify your API key is correct");
      suggestions.push("Check API key permissions");
      suggestions.push("Ensure the API key is properly configured");
    }

    if (message.includes("rate limit") || errorCode === ErrorCodes.RATE_LIMIT_EXCEEDED) {
      suggestions.push("Wait a few minutes before trying again");
      suggestions.push("Consider switching to a different provider");
      suggestions.push("Reduce the frequency of requests");
    }

    if (message.includes("quota") || message.includes("billing")) {
      suggestions.push("Check your account billing status");
      suggestions.push("Verify your service quota limits");
      suggestions.push("Consider upgrading your plan");
    }

    if (message.includes("invalid") || message.includes("validation")) {
      suggestions.push("Review the input parameters");
      suggestions.push("Check the format of your request");
      suggestions.push("Verify all required fields are provided");
    }

    if (message.includes("not found") || message.includes("404")) {
      suggestions.push("Verify the resource exists");
      suggestions.push("Check the resource identifier");
      suggestions.push("Ensure you have access to the resource");
    }

    if (message.includes("permission") || message.includes("unauthorized")) {
      suggestions.push("Check your account permissions");
      suggestions.push("Verify your authentication credentials");
      suggestions.push("Contact your administrator if needed");
    }

    if (errorCode === ErrorCodes.MODEL_NOT_SUPPORTED) {
      suggestions.push("Try a different model");
      suggestions.push("Check available models for your provider");
      suggestions.push("Verify model compatibility");
    }

    if (errorCode === ErrorCodes.GENERATION_FAILED) {
      suggestions.push("Try with a smaller code selection");
      suggestions.push("Simplify your prompt");
      suggestions.push("Try a different provider");
    }

    if (operation.includes("generation") || operation.includes("wiki")) {
      if (suggestions.length === 0) {
        suggestions.push("Try again with a different prompt");
        suggestions.push("Check your provider configuration");
      }
    }

    if (suggestions.length === 0) {
      suggestions.push("Try again in a few moments");
      suggestions.push("Check the logs for more details");
    }

    return suggestions;
  }

  private static extractErrorCode(error: Error): string | undefined {
    if ("code" in error && typeof error.code === "string") {
      return error.code;
    }

    const codeMatch = error.message.match(/\[([A-Z_]+)\]/);
    if (codeMatch) {
      return codeMatch[1];
    }

    return undefined;
  }
}
