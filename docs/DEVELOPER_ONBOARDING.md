# Developer Onboarding Guide

## Welcome to Qwiki

This guide will help you get started with developing the Qwiki VS Code extension. Qwiki is a VS Code extension that generates documentation for code using AI models.

## Audience & Guardrails

- **AI agents**
  - Do not run, build, or preview the extension unless explicitly asked.
  - Avoid adding code comments; keep functions short, simple, and self-explanatory.
  - Do not create tests unless the request calls for them.
  - Use existing services, repositories, factories, constants, and the DI container—never bypass the established seams.
- **Human developers**
  - Follow this onboarding guide for local setup, debugging, and contribution workflow details.
  - Prefer the same architectural seams outlined here and in `docs/ARCHITECTURE.md` to keep contributions consistent.

## Prerequisites

Before you start, make sure you have:

- Node.js (v18 or higher)
- pnpm package manager
- Visual Studio Code
- Basic knowledge of TypeScript
- Understanding of VS Code extension development

## Getting Started

Follow the quick start instructions in `README.md` to clone the repository, install dependencies, build the webview, and launch the extension host. Once your environment matches the README checklist, return here for day-to-day workflows and guardrails.

## Development Rules

### Strict Rules

1. **Never use `any` type** - use explicit types or `unknown` with type guards instead.
2. No debug logging unless specifically requested.
3. Do not add code comments—write clear, self-explanatory code instead.
4. Skip automated tests unless the task explicitly calls for them.
5. Avoid running, compiling, or previewing the project unless instructed.
6. Keep implementations simple; break down complicated logic and long functions.
7. Separate logic and data—do not hardcode data inside core logic.

### Conventions You Must Not Break

- Resolve dependencies through the DI container (`AppBootstrap`, factories, or `Container`), never instantiate concrete classes inline.
- Import commands, events, limits, error codes, and other shared values from `src/constants/index.ts`; do not introduce magic strings.
- Prefer barrel exports to deep relative paths.
- Communicate with the webview exclusively through `MessageBusService` and the defined event constants.
- Use repository abstractions for configuration and secrets; never access VS Code APIs for storage directly from application logic.

### Do & Don't Checklist

- **Do**
  - Use specialized command factories (`CoreCommandFactory`, `ProviderCommandFactory`, etc.) and `CommandRegistry` when exposing new commands.
  - Register commands with metadata (group, readiness requirements, timeout) via `CommandMetadata.ts`.
  - Register services in appropriate registration modules (`CoreServiceRegistrations.ts`, `ContextServiceRegistrations.ts`, etc.) which are called from `AppBootstrap`.
  - Wire readiness in `ServiceTiers.ts` when services affect command dependencies or initialization.
  - Publish UI updates through `MessageBusService` and respect the defined `OutboundEvents` payloads.
  - Follow `FilePatterns`, `FileLimits`, and `PathPatterns` when scanning the workspace.
  - Read and write configuration exclusively via `ConfigurationManagerService` and its validation helpers.
  - Check file sizes with the `read_file` tool metadata to keep all files under 300 lines (100% compliance achieved).
- **Don't**
  - Bypass the DI container or construct services inline.
  - Post messages directly to a webview without going through the message bus.
  - Introduce new magic strings for commands, events, or paths.
  - Store secrets or configuration outside of the provided repositories/managers.
  - Add comments, overly long methods, or complex branching when a simpler decomposition exists.
  - Ignore readiness: never bypass `ServiceReadinessManager` when a command depends on late-loading services.
  - Use shell utilities (`wc -l`, etc.) to check file length—instead rely on tooling output.

## Project Structure

Refer to `docs/ARCHITECTURE.md` for the canonical breakdown of layers, modules, and service catalogs. This onboarding guide focuses on workflows and conventions you will use after setup.

## Key Concepts

### 1. Architecture Layers

The extension follows a layered architecture:

- **Domain Layer**: Core business entities and interfaces
- **Application Layer**: Services, commands, and business logic
- **Infrastructure Layer**: External integrations and implementations
- **Presentation Layer**: UI components and webviews

### 2. Dependency Injection

The extension uses a dependency injection container to manage services:

```typescript
// Register a service
container.register("serviceName", () => new Service());

// Get a service
const service = container.get<Service>("serviceName");
```

### 3. Command Pattern

All user actions are implemented as commands:

```typescript
class GenerateWikiCommand implements Command {
  async execute(...args: unknown[]): Promise<unknown> {
    // Command implementation
  }
}
```

### 4. Repository Pattern

Data access is abstracted through repositories:

```typescript
interface ApiKeyRepository {
  save(provider: string, apiKey: string): Promise<void>;
  get(provider: string): Promise<string | undefined>;
  delete(provider: string): Promise<void>;
  list(): Promise<string[]>;
}
```

### 5. Context Intelligence Pipeline

The Context Intelligence Pipeline optimizes the context sent to LLM providers by selecting the most relevant files within token budget limits.

**Key Components:**

- **Project Indexing**: Maintains a fast-access index of project files with metadata
- **File Relevance Analysis**: Ranks files by relevance using dependencies, imports, and symbol usage
- **Token Budget Management**: Calculates optimal token allocation for context, prompt, and output
- **File Selection**: Selects the best files to include within the token budget
- **Context Compression**: Applies compression when needed to fit within limits

**Workflow:**

```typescript
// Example usage in wiki generation
const contextIntelligence = container.get<ContextIntelligenceService>("contextIntelligenceService");

const optimalContext = await contextIntelligence.selectOptimalContext(
  targetFile,
  providerId,
  model,
  (step) => console.log(`Progress: ${step.label}`),
);

// optimalContext includes:
// - Selected files ranked by relevance
// - Project type detection
// - Essential files identification
// - Token usage statistics
// - Relevance scores per file
```

### 6. Result Pattern for Error Handling

The Result pattern provides type-safe error handling for expected failures, making error handling explicit in the type system.

**Key Components:**

- **Result Type**: `Result<T, E>` discriminated union type
- **Helper Functions**: `ok()`, `err()`, `isOk()`, `isErr()`, `unwrap()`, `map()`, `andThen()`
- **Usage**: Validation functions, business logic that can fail expectedly

**Example Usage:**

```typescript
import { Result, ok, err, isOk } from "@/domain/types";

// In a validation service
async function validateConfiguration(
  config: unknown,
): Promise<Result<ValidatedConfig, ValidationError>> {
  const errors: string[] = [];

  if (!config.apiKey) {
    errors.push("API key is required");
  }

  if (errors.length > 0) {
    return err(new ValidationError(errors));
  }

  return ok(config as ValidatedConfig);
}

// Usage
const result = await validateConfiguration(userConfig);
if (isOk(result)) {
  await saveConfig(result.value);
} else {
  logger.error("Validation failed", { error: result.error });
  messageBus.postError({
    code: "VALIDATION_ERROR",
    message: result.error.message,
    suggestions: result.error.errors,
    timestamp: Date.now(),
    context: { config },
  });
}
```

**Location**: `src/domain/types/Result.ts`

### 7. Rate Limiting

Rate limiting is enforced for LLM API calls to prevent abuse and ensure fair usage.

**Key Components:**

- **RateLimiterService**: Manages per-key rate limiters with sliding window algorithm
- **Integration**: Automatically applied in `LLMRegistry.generate()` before API calls
- **Configuration**: Default limits defined in `ServiceLimits` constants

**Example Usage:**

```typescript
// Rate limiting is automatically applied in LLMRegistry.generate()
// For custom usage:
const rateLimiter = container.resolve<RateLimiterService>("rateLimiterService");

try {
  await rateLimiter.checkLimit(`provider:${providerId}`);
  // Make API call
} catch (error: unknown) {
  if (error.code === ErrorCodes.RATE_LIMIT_EXCEEDED) {
    // Handle rate limit error
    const waitTime = error.waitTimeMs;
    logger.warn("Rate limit exceeded", { waitTime });
  }
}
```

**Location**: `src/infrastructure/services/optimization/RateLimiterService.ts`

**Registered as**: `"rateLimiterService"` via `registerInfrastructureServices()`

### 8. README Automation Workflow

The README Automation feature provides an AI-powered workflow for generating and updating README files from saved wiki documentation.

**Key Components:**

- **Analysis**: Examines existing README structure and wiki content
- **Generation**: Creates updated README using AI with current project context
- **Preview**: Shows diff of changes before applying
- **Approval**: User reviews and approves/rejects changes
- **Backup**: Creates automatic backups before updates
- **Rollback**: Supports undoing README updates

**Workflow:**

```typescript
// Example usage
const readmeUpdate = container.get<ReadmeUpdateService>("readmeUpdateService");

// 1. Generate preview
const result = await readmeUpdate.updateReadmeFromWikis(wikiIds, {
  providerId,
  model,
  backupOriginal: true,
});

// 2. User reviews preview in UI
// 3. User approves or cancels

// 4. Apply approved changes
if (result.requiresApproval) {
  await readmeUpdate.applyApprovedChanges(result.preview.id);
}

// 5. Rollback if needed
await readmeUpdate.undoLastUpdate();
```

### 9. Service Readiness & Initialization

- `ServiceReadinessManager` centralizes readiness tracking, provides `isReady`, `waitForService`, and emits readiness events (`service:ready`, `critical:ready`, `commandWaiting`).
- `ServiceTiers.ts` defines critical (< 500ms) and background (< 30s) tiers, immediate commands, command dependency maps, and timeout budgets used by the readiness pipeline.
- `AppBootstrap` registers tiers and command requirements, initializes critical services synchronously, starts background services in parallel, publishes `backgroundInitProgress`, and exposes `criticalInitPromise`/`backgroundInitPromise`.
- `ProjectIndexService.quickInit()` hydrates cached index data immediately, marks the service ready for degraded workflows, and completes the full scan asynchronously with cache invalidation and watchers.
- `WebviewMessageHandler` enforces readiness-aware command execution, waits only for critical services, emits `commandWaiting` payloads, and sends timeouts via the centralized error modal when dependencies remain unready.
- `EnvironmentStatusManager` aggregates readiness data so the webview environment store can render initialization progress, availability banners, and degraded state messaging.

### 10. VS Code Language Features

The extension provides VS Code language features for enhanced development experience:

**Features:**

- **Hover Providers**: Show wiki documentation on hover
- **Completion Providers**: Suggest wiki-documented items
- **Diagnostic Providers**: Surface documentation warnings
- **Code Actions**: Quick fixes for documentation issues
- **Document Symbols**: Navigate wiki structure
- **Tree Views**: Browse saved wikis in sidebar
- **Custom Editors**: Edit wiki files with custom UI

### 11. Performance Optimizations

The system includes comprehensive performance optimizations:

**File Relevance Analysis**:

- Pre-computed relevance scores stored during indexing
- Analysis time reduced from 20-30s to <1s for cached results
- Batch processing with configurable concurrency (default: 16 files in parallel)
- Multi-factor scoring combining semantic similarity, imports, dependencies, and recency

**Webview Communication**:

- Priority-based message batching (immediate, high, normal, low)
- Message deduplication prevents duplicate updates
- Reduced message overhead by 20-30%

**Context Caching**:

- Project context cached with file hash validation
- Cache hit rate >80% for unchanged projects
- Smart cache invalidation only affects dependent caches

**Language Server Integration**:

- Symbol information pre-fetched during indexing
- Batched queries using `workspace.symbols` API
- 10-second timeout with fallback to code analysis
- Query time reduced from 58s to <10s for cached results

### 12. Enhanced Type Safety

The codebase maintains strict type safety:

**Zero `any` Types**:

- All `any` types replaced with explicit types or `unknown` with type guards
- Branded types for IDs prevent mixing similar primitives
- Strict TypeScript configuration enforced

**Type Guards**:

- Runtime type validation for external data
- Type guards used before accessing unknown properties
- Discriminated unions for complex state management

**Example**:

```typescript
function isWikiData(value: unknown): value is WikiData {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "content" in value &&
    typeof value.id === "string" &&
    typeof value.content === "string"
  );
}
```

### 13. Enhanced Error Handling

Error handling includes comprehensive context and recovery:

**Error Context**:

- All errors include operation context, user-friendly messages, and recovery suggestions
- Error analytics track error rates, common errors, and error patterns
- Error rate spike detection and alerting

**Error Recovery**:

- Automatic retry with exponential backoff for transient errors
- Fallback strategies for failed operations
- Graceful degradation when services unavailable

**Example**:

```typescript
const errorRecovery = container.get<ErrorRecoveryService>("errorRecoveryService");

await errorRecovery.retryWithBackoff(
  async () => await generateWiki(prompt),
  maxRetries: 3,
  baseDelay: 1000
);
```

### 14. Performance Monitoring

Performance monitoring tracks operations and identifies bottlenecks:

**Performance Budgets**:

- Defined budgets for all operations (p50, p95, p99 percentiles)
- Automatic budget checking with alerts when thresholds exceeded
- Cache hit rate tracking for all cached operations

**Metrics Collection**:

- Operation duration percentile tracking
- Token usage efficiency monitoring
- Performance trends visible over time

**Example**:

```typescript
const performanceMonitor = container.get<PerformanceMonitorService>("performanceMonitorService");

performanceMonitor.recordOperation("generateWiki", duration);
const percentiles = performanceMonitor.getPercentiles("generateWiki");
```

## Development Workflow

### 1. Making Changes

1. Identify the appropriate layer for your changes
2. Follow the existing patterns and conventions
3. Ensure your code follows SOLID principles
4. Test your changes in the development environment

### 2. Adding New Features

1. Define domain entities if needed
2. Create repository interfaces
3. Implement application services
4. Create commands for user interactions
5. Add infrastructure implementations
6. Update UI components if necessary

### 3. Adding New LLM Providers

Follow the canonical contract in `docs/API_REFERENCE.md#llm-provider-api` for interface details, manifests, lifecycle hooks, and discovery rules. After your provider adheres to those requirements, register it through the DI container and provider registry as outlined in the API reference.

### 4. Working with Context Intelligence

The Context Intelligence system selects the most relevant files for LLM context:

Example usage:

```typescript
// In a command or service
const contextIntelligence = this.container.get<ContextIntelligenceService>("contextIntelligenceService");

const optimalContext = await contextIntelligence.selectOptimalContext(
  targetFilePath,
  providerId,
  model,
  (step: LoadingStep) => {
    // Report progress to UI
    this.messageBus.postLoadingStep(step);
  }
);

// Use optimalContext.files in your LLM request
const prompt = buildPrompt(optimalContext.files, ...);
```

**Key Services:**

- `ContextIntelligenceService`: Main orchestrator (located in `services/context/`)
- `FileRelevanceAnalysisService`: Analyzes file relevance (located in `services/context/relevance/`)
- `FileSelectionService`: Selects optimal files (located in `services/context/relevance/`)
- `ProjectIndexService`: Maintains project index (located in `infrastructure/services/`)
- `TokenBudgetCalculator`: Calculates token budgets (located in `services/context/orchestration/`)

### 5. Working with README Automation

The README Automation system generates and updates README files from wikis:

Example usage:

```typescript
// In a command
const readmeUpdate = this.container.get<ReadmeUpdateService>("readmeUpdateService");

// Generate update
const result = await readmeUpdate.updateReadmeFromWikis(wikiIds, {
  providerId,
  model,
  backupOriginal: true,
});

// Result includes change summary; diff view can be opened via the showReadmeDiff command when needed
if (!result.success) {
  // Surface conflicts back to the webview for error handling
  this.messageBus.postMessage("readmeUpdateFailed", result);
}
```

**Key Services:**

- `ReadmeUpdateService`: Main orchestrator
- `ReadmeAnalysisService`: Analyzes existing README
- `ReadmeGenerationService`: Generates new content
- `ReadmeBackupService`: Creates backups
- `VSCodeDiffService`: Opens native diff views on demand after README updates

### 6. Adding VS Code Language Features

To add new VS Code language features (hover, completions, diagnostics):

1. Create provider class in `src/providers/`
2. Implement VS Code provider interface
3. Register provider in extension activation
4. Add dispose logic for cleanup

Example:

```typescript
// src/providers/WikiHoverProvider.ts
export class WikiHoverProvider implements vscode.HoverProvider {
  async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
  ): Promise<vscode.Hover | undefined> {
    // Implementation
  }
}

// In extension.ts
const hoverProvider = new WikiHoverProvider();
context.subscriptions.push(vscode.languages.registerHoverProvider("typescript", hoverProvider));
```

## Debugging

### 1. Extension Debugging

1. Set breakpoints in your TypeScript code
2. Press F5 to launch the extension in debug mode
3. Use the VS Code debugger to step through code
4. Check the Debug Console for extension output

### 2. Webview Debugging

1. Open the Qwiki webview in the extension
2. Right-click in the webview and select "Inspect" to open DevTools
3. Use DevTools for webview debugging (Vue components, network, console)
4. Use Vue DevTools extension for better Vue debugging

### 3. Common Issues

- **Extension not loading**: Check the extension.ts file for errors, verify all dependencies are installed
- **Commands not working**: Verify command registration in CommandRegistry and constants
- **Services not available**: Ensure proper DI registration in AppBootstrap
- **Webview not communicating**: Check MessageBusService implementation and webview message handling
- **LLM provider errors**: Verify API keys are properly stored and provider configuration is correct
- **Build errors**: Ensure webview UI is built (`pnpm run build:webview`) before compiling extension

## Performance Considerations

### 1. Caching

- Use cached services for expensive operations
- Implement TTL-based caching where appropriate
- Cache webview messages to reduce communication overhead

### 2. Lazy Loading

- Services are lazy-loaded by default
- Use lazy loading for heavy initialization
- Consider lazy loading for webview components

### 3. Memory Management

- Dispose of resources properly
- Clean up event listeners
- Use weak references where appropriate

## Contributing Guidelines

### 1. Before Submitting

1. Ensure your code follows the project's style guidelines
2. Verify functionality in development environment
3. Update documentation if necessary

### 2. Pull Request Process

1. Create a feature branch from main
2. Make your changes following the established patterns
3. Verify functionality in development environment
4. Submit a pull request with a clear description
5. Address any feedback from code review

### 3. Code Review

- Focus on architecture adherence
- Check for SOLID principles violations
- Verify error handling implementation
- Ensure performance considerations are addressed

## Resources

### 1. Documentation

- [Architecture Documentation](./ARCHITECTURE.md)
- [Prompt Engineering Guide](./PROMPT_ENGINEERING_GUIDE.md)
- [Wiki Aggregation Documentation](./WIKI_AGGREGATION.md)
- [Quality Assurance Guide](./QUALITY_ASSURANCE_GUIDE.md)
- [SOLID Principles Implementation](./SOLID_PRINCIPLES.md)
- [VS Code Extension API](https://code.visualstudio.com/api)

### 2. Tools

- [VS Code Extension Development](https://code.visualstudio.com/api/get-started/your-first-extension)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vue.js Documentation](https://vuejs.org/guide/) (for webview UI)
- [Pinia State Management](https://pinia.vuejs.org/)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [shadcn/vue Components](https://www.shadcn-vue.com/)
- [Vite Build Tool](https://vitejs.dev/)

### 3. Best Practices

- [Clean Code Principles](https://clean-code-developer.com/)
- [SOLID Principles](https://en.wikipedia.org/wiki/SOLID)
- [Design Patterns](https://refactoring.guru/design-patterns)

## Getting Help

If you need help:

1. Check the existing documentation
2. Look at similar implementations in the codebase
3. Ask questions in team channels
4. Create an issue for bugs or feature requests

## Navigation System

### Overview

The QWiki navigation system uses a state machine pattern to manage page transitions with guard validation and separated loading states. It provides a single source of truth for navigation state and eliminates race conditions.

### Core Components

- **Navigation Store** (`webview-ui/src/stores/navigation.ts`): Single source of truth for navigation state with state machine
- **useNavigation Composable** (`webview-ui/src/composables/useNavigation.ts`): Reactive navigation API
- **usePageLoading Composable** (`webview-ui/src/composables/usePageLoading.ts`): Page-specific loading state management

### State Machine

The navigation system uses a finite state machine with four states:

- `idle`: No navigation in progress
- `validating`: Guard validation in progress
- `navigating`: Navigation transition in progress
- `blocked`: Navigation blocked by guard validation failure

### Usage Pattern

```vue
<script setup lang="ts">
import { useNavigation } from "@/composables/useNavigation";
import { usePageLoading } from "@/composables/usePageLoading";

const navigation = useNavigation();
const pageLoading = usePageLoading("wiki", "wiki");

// Navigate to a page
await navigation.navigateTo("settings");

// Check loading states
const isNavigating = pageLoading.showNavigationLoading.value;
const isPageLoading = pageLoading.showPageLoading.value;
</script>
```

### Navigation Guards

Navigation guards are pure validation functions that return structured results:

```typescript
const navigation = useNavigation();

navigation.setNavigationGuard(async (target, direction) => {
  if (target === "settings" && direction === "back") {
    const isValid = await validateSettings();
    return {
      allowed: isValid,
      error: isValid
        ? undefined
        : {
            message: "Settings validation failed",
            code: "VALIDATION_ERROR",
          },
    };
  }
  return { allowed: true };
});
```

## Loading System

### Overview

The QWiki loading system provides a sophisticated, multi-layered approach to managing loading states across the application. It combines visual components, centralized state management, and backend coordination to deliver a smooth user experience during asynchronous operations.

### Architecture

The loading system consists of four main layers:

1. **Frontend Components** - Visual loading indicators and animations
2. **Central Loading Store** - Unified state management for all loading contexts
3. **Loading Bus** - Message-based communication bridge
4. **Backend Integration** - Step-by-step progress tracking from services

### Key Components

#### 1. LoadingState Component

**Location:** `/webview-ui/src/components/features/LoadingState.vue`

The main loading component that renders a centered loading skeleton with animated steps.

**Props:**

```typescript
interface Props {
  context?: LoadingContext; // Loading context for automatic step resolution
  steps?: LoadingStepDefinition[]; // Custom steps array
  currentStep?: string; // Override current step
  density?: LoadingDensity; // Override density
  percent?: number | null; // Progress percentage
  isActive?: boolean; // Manual active state control
}
```

#### 2. Central Loading Store

**Location:** `/webview-ui/src/stores/loading.ts`

Central coordinator that owns loading state per context (`wiki`, `settings`, `navigation`, `environment`, `savedWikis`, `errorHistory`).

### Error System Architecture

The QWiki error system provides centralized error management with automatic cleanup on navigation:

**Core Components**:

- **Error Store** (`webview-ui/src/stores/error.ts`): Single source of truth for error state
- **GlobalErrorModal** (`webview-ui/src/components/GlobalErrorModal.vue`): Single error modal instance in App.vue
- **useError Composable** (`webview-ui/src/composables/useError.ts`): Convenience methods for error reporting

**Key Features**:

- Automatic error clearing on page navigation
- Error lifecycle management (active → dismissed → archived)
- Configurable error actions (retry, navigate, custom)
- Error history preservation
- Page context tracking

**Usage Pattern**:

```typescript
import { useError } from "@/composables/useError";

const { showError, showRetryableError, showConfigurationError } = useError();

// Show a simple error
showError({
  message: "Operation failed",
  code: "OPERATION_FAILED",
  suggestions: ["Check your connection", "Try again later"],
});

// Show retryable error
showRetryableError("Network request failed", () => retryOperation(), { code: "NETWORK_ERROR" });

// Show configuration error with navigation action
showConfigurationError("API key is missing", "API_KEY_MISSING");
```

**Core Actions:**

- `start(options)` - Begin loading with optional step and timeout
- `advance(options)` - Progress to next step with optional percentage
- `complete(options)` - Mark loading as finished successfully
- `fail(options)` - Mark loading as failed with error message
- `cancel(options)` - Cancel loading with optional reason
- `reset(context)` - Clear all state for a context

#### 3. useLoading Composable

**Location:** `/webview-ui/src/loading/useLoading.ts`

Reactive composable for components to interact with loading state:

**Returns:**

- `state` - Computed LoadingStateSnapshot for context
- `isActive` - Computed boolean for active state
- `steps` - Computed array of LoadingStepDefinition
- `density` - Computed LoadingDensity
- Action methods: `start()`, `advance()`, `complete()`, `fail()`, `cancel()`, `reset()`

### Usage Patterns

#### When to Use LoadingState

1. **Async Operations:** API calls, data processing
2. **Page Transitions:** Navigation between pages
3. **Initial Loading:** Application startup
4. **Complex Operations:** Multi-step processes

#### Container Styling

Always use full-space containers for loading states:

```vue
<div class="flex h-full w-full items-center justify-center">
  <LoadingState ... />
</div>
```

#### Step Naming Conventions

- Use present participles: "Loading...", "Fetching...", "Preparing..."
- Be specific about the operation: "Analyzing code structure..."
- Keep descriptions concise but informative
- Use consistent terminology across the application

#### Central Store Usage

- Prefer `useLoading(context)` composable over local loading state
- Use context-specific step definitions from `stepCatalog`
- Leverage automatic timeout handling
- Integrate with loading bus for backend progress updates

### Loading Contexts

The system supports these predefined contexts:

- **wiki**: Wiki generation process (10s timeout, medium density)
- **settings**: Settings initialization (5s timeout, low density)
- **navigation**: Page navigation (5s timeout, low density)
- **environment**: Service readiness (8s timeout, low density)
- **savedWikis**: Wiki collection loading (8s timeout, low density)
- **errorHistory**: Error gathering (5s timeout, low density)

### Integration Examples

#### Wiki Page Loading

```vue
<div v-if="wikiLoadingContext.isActive.value" class="h-full">
  <LoadingState context="wiki" />
</div>
```

#### Settings Page Loading

```vue
<div v-if="isSettingsLoading" class="flex h-full w-full">
  <LoadingState context="settings" />
</div>
```

### Backend Integration

Loading steps are communicated through progress callbacks:

```typescript
await this.wikiService.generateWiki(request, projectContext, (step: LoadingStep) => {
  this.eventBus.publish(OutboundEvents.loadingStep, { step });
});
```

### Error Handling

#### Loading Timeouts

- **Wiki Generation:** 10 seconds timeout
- **Settings Initialization:** 5 seconds timeout
- **Navigation:** 5 seconds timeout
- **Environment Loading:** 8 seconds timeout
- **Saved Wikis:** 8 seconds timeout
- **Error History:** 5 seconds timeout

#### Common Issues

1. **Loading Not Centered:** Ensure parent container has `h-full w-full`
2. **Steps Not Updating:** Check `loadingStep` message flow through loading bus
3. **Animation Issues:** Verify CSS custom properties are available
4. **Timeout Issues:** Review backend processing times and context-specific timeouts
5. **Context Not Found:** Verify context is defined in `KNOWN_CONTEXTS` array
6. **Store Not Updating:** Check if `loadingBus` is properly initialized

### Debug Information

Loading states include comprehensive logging:

- `[QWIKI] Settings Store:` prefix for settings operations
- `[QWIKI] Wiki Service:` prefix for generation operations
- Timing information for performance monitoring
- Error details for troubleshooting
- Central loading store state inspection via browser dev tools

### Migration Guide

#### From Legacy Loading State

To migrate from legacy loading patterns to the new centralized system:

1. **Replace Local State:**

   ```typescript
   // Old
   const loading = ref(false);
   const loadingStep = ref("");

   // New
   const loadingContext = useLoading("contextName");
   ```

2. **Update Component Templates:**

   ```vue
   <!-- Old -->
   <div v-if="loading" class="loading-container">
     <CustomLoading :step="loadingStep" />
   </div>

   <!-- New -->
   <div v-if="loadingContext.isActive.value" class="flex h-full w-full">
     <LoadingState context="contextName" />
   </div>
   ```

3. **Update Store Actions:**

   ```typescript
   // Old
   this.loading = true;
   this.loadingStep = "processing";

   // New
   const loadingStore = useLoadingStore();
   loadingStore.start({ context: "contextName", step: "processing" });
   ```

## Quick Reference

### Common File Locations

- Commands: `src/application/commands/` (organized by domain: `core/`, `providers/`, `configuration/`, `wikis/`, `readme/`, `utilities/`)
- Command Factories: `src/factories/commands/` (CoreCommandFactory, ProviderCommandFactory, etc.)
- Command Metadata: `src/application/commands/CommandMetadata.ts`
- Services: `src/application/services/` (organized by domain: `core/`, `context/`, `configuration/`, `documentation/`, `prompts/`, `readme/`, `providers/`, `storage/`)
- Bootstrap: `src/application/bootstrap/` (AppBootstrap, ServiceRegistrar, InitializationOrchestrator, ReadinessCoordinator)
- Service Registrations: `src/application/bootstrap/registrations/` (CoreServiceRegistrations, ContextServiceRegistrations, etc.)
- Initializers: `src/application/bootstrap/initializers/` (CriticalServicesInitializer, BackgroundServicesInitializer)
- Context Intelligence: `src/application/services/context/`
- README Automation: `src/application/services/readme/`
- Repositories: `src/infrastructure/repositories/`
- LLM Providers: `src/llm/providers/`
- Language Features: `src/providers/`
- Tree Views: `src/views/`
- Constants: `src/constants/`
- Error Classes: `src/errors/`
- Domain Types: `src/domain/types/` (Result pattern)
- Webview UI: `webview-ui/src/`
- Navigation Store: `webview-ui/src/stores/navigation.ts`
- Loading Store: `webview-ui/src/stores/loading.ts`
- Navigation Composables: `webview-ui/src/composables/useNavigation.ts`, `webview-ui/src/composables/usePageLoading.ts`
- Error Composable: `webview-ui/src/composables/useError.ts`
- Loading Components: `webview-ui/src/components/features/LoadingState.vue`
- DI Container: `src/container/Container.ts`
- Extension Entry: `src/extension.ts`
- Project Index: `src/infrastructure/services/ProjectIndexService.ts`
- Environment Monitoring: `src/infrastructure/services/EnvironmentMonitoringService.ts`
- Rate Limiting: `src/infrastructure/services/optimization/RateLimiterService.ts`
- LRU Cache: `src/infrastructure/services/caching/LRUCache.ts`

### Common Patterns

- **Command Pattern**: All user actions
- **Repository Pattern**: Data access
- **Factory Pattern**: Object creation
- **Dependency Injection**: Service management
- **Event System**: Loose coupling
- **State Machine Navigation**: Navigation with guard validation
- **Central Loading**: Unified loading state management

### Key Classes

- `CommandRegistry`: Command management
- `Container`: Dependency injection
- `MessageBusService`: Webview communication
- `EventBus`: Event system
- `AppBootstrap`: Application initialization
- `useNavigation`: Navigation composable with reactive state
- `usePageLoading`: Page-specific loading state composable
- `useError`: Error reporting composable with automatic context injection
- `useLoading`: Loading state composable
- `NavigationStore`: Navigation state machine with guard validation
- `LoadingStore`: Central loading state management
- `ContextIntelligenceService`: Orchestrates optimal context selection
- `ReadmeUpdateService`: Orchestrates README automation workflow
- `LLMRegistry`: Provider discovery and lifecycle management
- `ProviderValidationService`: Validates provider configurations
- `ProjectIndexService`: Maintains project file index
- `EnvironmentMonitoringService`: Real-time health monitoring
- `RateLimiterService`: Rate limiting for API calls
- `Result<T, E>`: Type-safe error handling for expected failures

Remember: The goal is to maintain clean, modular, and maintainable code following SOLID principles. When in doubt, look at existing implementations for guidance.
