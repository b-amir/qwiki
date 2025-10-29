# Qwiki API Reference

This document provides detailed API documentation for Qwiki's LLM providers and extension commands.

**Important**: Qwiki is a local-only VS Code extension. All processing happens within the user's IDE. Code snippets are sent to external LLM providers (configured by the user) for documentation generation, but no data is stored on external servers.

## Table of Contents

1. [LLM Provider API](#llm-provider-api)
2. [Extension Commands](#extension-commands)
3. [Message Types](#message-types)
4. [Configuration API](#configuration-api)
5. [Error Handling](#error-handling)

## LLM Provider API

### Current Architecture: Registry Pattern

**Important Note**: The system currently uses a **Registry Pattern**, not a Factory pattern as previously documented. Providers are statically instantiated and registered, not dynamically created.

### Core Interface

All LLM providers must implement the `LLMProvider` interface:

```typescript
interface LLMProvider {
  id: string;
  name: string;
  requiresApiKey: boolean;
  generate(params: GenerateParams, apiKey: string | undefined): Promise<GenerateResult>;
  listModels(): string[];
  getUiConfig?(): ProviderUiConfig;
}
```

### Provider Registration System

**Current Implementation**:

```typescript
// src/llm/providers/registry.ts
export function loadProviders(getSetting: GetSetting): Record<string, LLMProvider> {
  const providers: Record<string, LLMProvider> = {};
  providers["google-ai-studio"] = new GoogleAIStudioProvider(getSetting);
  providers["zai"] = new ZAiProvider(getSetting);
  // ... hardcoded instantiation
  return providers;
}
```

**Limitations**:

- Hardcoded provider instantiation
- Requires core code changes to add providers
- No runtime discovery capabilities
- Not truly extensible without modification

**Future Vision: Plugin Architecture**:

```typescript
// Planned: Dynamic provider discovery
interface ProviderPlugin {
  id: string;
  provider: () => Promise<LLMProvider>;
  capabilities: ProviderCapabilities;
}

// Providers will register themselves
registerProvider({
  id: "new-provider",
  capabilities: { maxTokens: 4096, features: ["streaming"] },
  provider: () => import("./new-provider").then((p) => new p.NewProvider()),
});
```

### Generate Parameters

```typescript
type GenerateParams = {
  snippet: string; // Code snippet to document
  languageId?: string; // Language identifier (e.g., 'typescript', 'python')
  filePath?: string; // File path context
  model?: string; // Specific model to use
  project?: {
    // Project context
    rootName?: string; // Project root name
    overview?: string; // Project overview
    filesSample?: string[]; // Sample files for context
    related?: Array<{
      // Related files
      path: string;
      preview?: string;
      line?: number;
      reason?: string;
    }>;
  };
};
```

### Generate Result

```typescript
type GenerateResult = {
  content: string; // Generated documentation
};
```

### Provider UI Configuration

```typescript
interface ProviderUiConfig {
  apiKeyUrl: string; // URL to get API key
  apiKeyInput: string; // API key input label
  additionalInfo?: string; // Additional help text
  modelFallbackIds?: string[]; // Fallback model IDs
  defaultModel?: string; // Default model selection
  customFields?: ProviderCustomField[]; // Custom configuration fields
}

interface ProviderCustomField {
  id: string; // Field identifier
  label: string; // Display label
  type: "text" | "select"; // Field type
  placeholder?: string; // Placeholder text
  options?: string[]; // Select options (for type 'select')
  defaultValue?: string; // Default value
}
```

### Data vs Logic Separation

**Current State Analysis**:

**✅ Well Separated**:

- Provider-specific HTTP logic and endpoints
- Model lists and availability
- UI configuration definitions
- API key requirements and validation

**⚠️ Partially Separated**:

- Prompt building (external `buildWikiPrompt` function)
- Error handling (inconsistent across providers)
- Parameter processing (some leakage to services)

**❌ Needs Improvement**:

- Configuration access patterns
- Standardized error types
- Provider capability discovery
- Runtime extensibility

**Future Improvements**:

- Provider-specific prompt strategies
- Standardized error handling with `ProviderError` class
- Dynamic capability discovery
- Better configuration abstraction

````

## Supported Providers

### Google AI Studio

- **Provider ID**: `google-ai-studio`
- **Requires API Key**: Yes
- **Configuration**:
  - Endpoint type: OpenAI-compatible or native
  - Base URL: Configurable through VS Code settings
- **Models**: Various Gemini models

### Z.ai

- **Provider ID**: `zai`
- **Requires API Key**: Yes
- **Configuration**:
  - Base URL: Configurable (OpenAI-compatible)
- **Models**: Configurable model selection

### OpenRouter

- **Provider ID**: `openrouter`
- **Requires API Key**: Yes
- **Configuration**: Standard OpenAI-compatible API
- **Models**: Multiple models available

### Cohere

- **Provider ID**: `cohere`
- **Requires API Key**: Yes
- **Configuration**: Direct Cohere API integration
- **Models**: Command, Command-Light, etc.

### HuggingFace

- **Provider ID**: `huggingface`
- **Requires API Key**: Yes
- **Configuration**: Inference API integration
- **Models**: Various open-source models

## Extension Commands

### Core Commands

#### Generate Wiki

**Command ID**: `generateWiki`

Generates documentation for selected code or file.

**Parameters**:
```typescript
{
  selection?: string;       // Selected text (optional)
  filePath?: string;        // File path (optional)
  languageId?: string;      // Language identifier
  providerId?: string;      // LLM provider ID
  model?: string;          // Specific model
}
````

**Returns**:

```typescript
{
  content: string; // Generated documentation
  provider: string; // Provider used
  model: string; // Model used
}
```

#### Get Selection

**Command ID**: `getSelection`

Gets the current editor selection.

**Parameters**: None

**Returns**:

```typescript
{
  selection: string; // Selected text
  filePath: string; // Current file path
  languageId: string; // Language identifier
  startLine: number; // Selection start line
  endLine: number; // Selection end line
}
```

#### Get Related Files

**Command ID**: `getRelated`

Finds files related to the current context.

**Parameters**:

```typescript
{
  filePath?: string;        // Reference file path
  maxResults?: number;      // Maximum number of results
}
```

**Returns**:

```typescript
{
  files: Array<{
    path: string;
    preview?: string;
    line?: number;
    reason?: string;
  }>;
}
```

### Configuration Commands

#### Save API Key

**Command ID**: `saveApiKey`

Saves an API key for a provider.

**Parameters**:

```typescript
{
  providerId: string; // Provider ID
  apiKey: string; // API key to save
}
```

**Returns**: Success confirmation

#### Get API Keys

**Command ID**: `getApiKeys`

Lists all saved API keys.

**Parameters**: None

**Returns**:

```typescript
{
  providers: string[];      // List of provider IDs with saved keys
}
```

#### Delete API Key

**Command ID**: `deleteApiKey`

Deletes an API key for a provider.

**Parameters**:

```typescript
{
  providerId: string; // Provider ID
}
```

**Returns**: Success confirmation

#### Get Providers

**Command ID**: `getProviders`

Lists all available LLM providers.

**Parameters**: None

**Returns**:

```typescript
{
  providers: Array<{
    id: string;
    name: string;
    requiresApiKey: boolean;
    configured: boolean;
  }>;
}
```

#### Get Provider Configs

**Command ID**: `getProviderConfigs`

Gets UI configurations for all providers.

**Parameters**: None

**Returns**:

```typescript
{
  configs: Record<string, ProviderUiConfig>;
}
```

### Settings Commands

#### Save Setting

**Command ID**: `saveSetting`

Saves a configuration setting.

**Parameters**:

```typescript
{
  key: string; // Setting key
  value: any; // Setting value
}
```

**Returns**: Success confirmation

#### Get Configuration

**Command ID**: `getConfiguration`

Gets current configuration.

**Parameters**: None

**Returns**:

```typescript
{
  [key: string]: any;      // Configuration key-value pairs
}
```

#### Update Configuration

**Command ID**: `updateConfiguration`

Updates multiple configuration settings.

**Parameters**:

```typescript
{
  settings: Record<string, any>; // Settings to update
}
```

**Returns**: Success confirmation

### Utility Commands

#### Open File

**Command ID**: `openFile`

Opens a file in the editor.

**Parameters**:

```typescript
{
  path: string;            // File path to open
  line?: number;           // Line number to focus
}
```

**Returns**: Success confirmation

## Message Types

### Webview to Extension

Messages sent from the webview to the extension follow this structure:

```typescript
interface WebviewMessage {
  command: string; // Command ID
  requestId?: string; // Request identifier for async operations
  params?: any; // Command parameters
}
```

### Extension to Webview

Responses from the extension to the webview:

```typescript
interface ExtensionMessage {
  type: "response" | "event" | "error";
  requestId?: string; // Original request ID
  data?: any; // Response data
  error?: string; // Error message (if type is 'error')
}
```

## Configuration API

### VS Code Settings

The extension exposes the following VS Code settings:

```json
{
  "qwiki.zaiBaseUrl": {
    "type": "string",
    "default": "",
    "description": "Z.ai API base URL (OpenAI-compatible)"
  },
  "qwiki.googleAIEndpoint": {
    "type": "string",
    "enum": ["openai-compatible", "native"],
    "default": "openai-compatible",
    "description": "Google AI Studio endpoint type"
  }
}
```

### Runtime Configuration

Configuration is managed through the `ConfigurationManager` service:

- **API Keys**: Stored securely using VS Code's secret storage
- **Provider Settings**: Provider-specific configuration
- **User Preferences**: Customizable user settings

## Error Handling

### Error Types

The extension uses standardized error classes for different error scenarios:

```typescript
class ProviderError extends Error {
  code: string;
  message: string;
  providerId?: string;
  originalError?: any;

  constructor(code: string, message: string, providerId?: string, originalError?: any);
  toJSON(): ErrorObject;
  static fromError(error: any, providerId?: string): ProviderError;
}

interface ErrorObject {
  code: string;
  message: string;
  providerId?: string;
  originalError?: any;
}
```

### Error Recovery Service

```typescript
class ErrorRecoveryService {
  canRetry(error: ProviderError): boolean;
  getRetryDelay(attempt: number, error: ProviderError): number;
  shouldFallback(error: ProviderError): boolean;
  getUserFriendlyMessage(error: ProviderError): string;
  getActionableSuggestion(error: ProviderError): string;
}
```

### Error Response Format

```typescript
interface ErrorResponse {
  type: "error";
  code: string; // Error code
  message: string; // Human-readable error message
  suggestions?: string[]; // Actionable suggestions
  retryable?: boolean; // Whether the operation can be retried
  requestId?: string; // Original request ID
}
```

### Standardized Error Codes

#### Provider Errors

- `PROVIDER_NOT_FOUND`: Requested provider is not available
- `PROVIDER_UNHEALTHY`: Provider health check failed
- `PROVIDER_INITIALIZATION_FAILED`: Provider failed to initialize

#### Authentication Errors

- `API_KEY_MISSING`: Required API key is not configured
- `API_KEY_INVALID`: API key is invalid or expired
- `API_KEY_REVOKED`: API key has been revoked

#### Model Errors

- `MODEL_NOT_SUPPORTED`: Requested model is not supported by provider
- `MODEL_NOT_AVAILABLE`: Model is temporarily unavailable
- `MODEL_CONTEXT_EXCEEDED`: Input exceeds model's context window

#### Network Errors

- `NETWORK_ERROR`: Network connection failed
- `NETWORK_TIMEOUT`: Request timed out
- `RATE_LIMIT_EXCEEDED`: API rate limit exceeded
- `RATE_LIMIT_RETRY_AFTER`: Rate limit with retry-after header

#### Configuration Errors

- `VALIDATION_ERROR`: Invalid parameters provided
- `CONFIGURATION_ERROR`: Configuration is invalid
- `CONFIGURATION_MIGRATION_FAILED`: Failed to migrate configuration
- `CONFIGURATION_BACKUP_FAILED`: Failed to create configuration backup

#### Generation Errors

- `GENERATION_FAILED`: Documentation generation failed
- `GENERATION_TIMEOUT`: Generation request timed out
- `GENERATION_CANCELLED`: Generation was cancelled

## Usage Examples

### Generate Documentation

````typescript
// From webview
const message = {
  command: 'generateWiki',
  params: {
    selection: 'function example() { return "hello"; }',
    languageId: 'javascript',
    providerId: 'openrouter',
    model: 'gpt-3.5-turbo'
  }
};

// Response
{
  type: 'response',
  requestId: 'req-123',
  data: {
    content: '```javascript\n/**\n * Example function that returns a greeting\n * @returns {string} The greeting "hello"\n */\nfunction example() { return "hello"; }\n```',
    provider: 'openrouter',
    model: 'gpt-3.5-turbo'
  }
}
````

### Configure Provider

```typescript
// Save API key
{
  command: 'saveApiKey',
  params: {
    providerId: 'google-ai-studio',
    apiKey: 'your-api-key-here'
  }
}

// Get provider configs
{
  command: 'getProviderConfigs'
}

// Response
{
  type: 'response',
  data: {
    configs: {
      'google-ai-studio': {
        apiKeyUrl: 'https://aistudio.google.com/app/apikey',
        apiKeyInput: 'Google AI Studio API Key',
        additionalInfo: 'Get your API key from Google AI Studio',
        defaultModel: 'gemini-pro'
      }
    }
  }
}
```

## Development Notes

### Architecture Reality Check

**Current State**: The LLM provider system uses a **Registry Pattern** with static instantiation, not a Factory pattern. While functional, this has limitations for extensibility.

**Key Architectural Insights**:

- **Data Concentration**: Provider-specific data IS well concentrated in the providers folder
- **Logic Separation**: Mostly successful, but some leakage exists (prompt building, error handling)
- **Extensibility**: Limited - requires core code changes to add providers
- **Future Evolution**: Moving toward plugin architecture for true extensibility

### Adding New Providers

**Current Process**:

1. Implement `LLMProvider` interface
2. Add to hardcoded registry in `src/llm/providers/registry.ts`
3. Provider handles its own HTTP logic, models, and configuration

**Limitations**:

- Registry modification required
- No runtime discovery
- Tight coupling to core system

**Future Plugin System**:

- Dynamic provider registration
- Capability-based discovery
- No core code modifications needed

### Performance Considerations

- Use cached services for repeated operations
- Implement proper error handling for network requests
- Consider rate limiting for API calls
- Optimize message passing between webview and extension

### Architectural Debt

**Known Issues**:

1. **Registry vs Factory**: Documentation incorrectly claims Factory pattern
2. **Error Handling**: Inconsistent across providers
3. **Configuration Leakage**: Some provider knowledge in services

**Planned Improvements**:

1. **Plugin Architecture**: Dynamic provider discovery
2. **Standardized Errors**: Consistent error types and handling
3. **Better Separation**: Reduce configuration leakage
