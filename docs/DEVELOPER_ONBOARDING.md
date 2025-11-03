# Developer Onboarding Guide

## Welcome to Qwiki

This guide will help you get started with developing the Qwiki VS Code extension. Qwiki is a VS Code extension that generates documentation for code using AI models.

## Prerequisites

Before you start, make sure you have:

- Node.js (v18 or higher)
- pnpm package manager
- Visual Studio Code
- Basic knowledge of TypeScript
- Understanding of VS Code extension development

## Getting Started

### 1. Clone the Repository

```bash
git clone <repository-url>
cd qwiki
```

### 2. Install Dependencies

```bash
pnpm run install:all
```

This installs dependencies for both the extension and the webview UI.

### 3. Build the Webview UI

```bash
pnpm run build:webview
```

### 4. Build the Extension

```bash
pnpm run compile
```

### 5. Run in Development Mode

1. Open the project in VS Code
2. Press F5 to launch a new Extension Development Host window
3. In the new window, open a project folder
4. Open the Qwiki panel from the activity bar
5. Configure an LLM provider in the settings to test functionality

## Project Structure

The project follows a clean architecture with clear separation of concerns:

```
qwiki/
├── src/                      # Extension source code
│   ├── extension.ts          # Main extension entry point
│   ├── application/          # Application layer (services, commands)
│   │   ├── services/         # See ARCHITECTURE.md for complete list
│   │   │   ├── Core Services:
│   │   │   │   ├── WikiService.ts
│   │   │   │   ├── CachedWikiService.ts
│   │   │   │   ├── SelectionService.ts
│   │   │   │   ├── ProjectContextService.ts
│   │   │   │   ├── CachedProjectContextService.ts
│   │   │   │   ├── MessageBusService.ts
│   │   │   │   └── WikiStorageService.ts
│   │   │   ├── Configuration Services:
│   │   │   │   ├── ConfigurationManagerService.ts
│   │   │   │   ├── ConfigurationValidationEngineService.ts
│   │   │   │   ├── ConfigurationTemplateService.ts
│   │   │   │   ├── ConfigurationImportExportService.ts
│   │   │   │   └── ConfigurationMigrationService.ts
│   │   │   ├── Context Intelligence Services:
│   │   │   │   ├── ContextIntelligenceService.ts (Orchestrator)
│   │   │   │   ├── context/FileRelevanceAnalysisService.ts
│   │   │   │   ├── context/FileRelevanceBatchService.ts
│   │   │   │   ├── context/FileSelectionService.ts
│   │   │   │   ├── context/TokenBudgetCalculatorService.ts
│   │   │   │   ├── context/ProjectTypeDetectionService.ts
│   │   │   │   ├── context/EssentialFilesIdentifierService.ts
│   │   │   │   └── context/ContextCompressionService.ts
│   │   │   ├── README Automation Services:
│   │   │   │   ├── ReadmeUpdateService.ts (Orchestrator)
│   │   │   │   ├── readme/ReadmeAnalysisService.ts
│   │   │   │   ├── readme/ReadmeGenerationService.ts
│   │   │   │   ├── readme/ReadmeBackupService.ts
│   │   │   │   └── readme/ReadmeApprovalService.ts
│   │   │   └── Provider Services:
│   │   │       ├── ContextAnalysisService.ts (Orchestrator)
│   │   │       ├── context/PatternExtractionService.ts
│   │   │       ├── context/StructureAnalysisService.ts
│   │   │       ├── context/RelationshipAnalysisService.ts
│   │   │       ├── context/ComplexityCalculationService.ts
│   │   │       ├── SmartProviderSelectionService.ts
│   │   │       ├── ProviderSelectionService.ts
│   │   │       ├── ProviderFallbackManagerService.ts
│   │   │       ├── ProviderDiscoveryService.ts
│   │   │       ├── ProviderLifecycleManagerService.ts
│   │   │       ├── ProviderDependencyResolverService.ts
│   │   │       ├── ProviderValidationService.ts
│   │   │       └── ProviderSelectionIntegrationService.ts
│   │   ├── transformers/     # Data transformation layer
│   │   │   └── WikiTransformer.ts
│   │   ├── commands/         # See ARCHITECTURE.md for complete list
│   │   │   ├── Command.ts    # Base interface
│   │   │   ├── GenerateWikiCommand.ts
│   │   │   ├── GetSelectionCommand.ts
│   │   │   ├── SaveWikiCommand.ts
│   │   │   ├── Configuration commands (10+)
│   │   │   └── Provider commands (5+)
│   │   ├── CommandRegistry.ts
│   │   └── AppBootstrap.ts   # DI container setup
│   ├── domain/               # Domain entities and repository interfaces
│   ├── infrastructure/       # External integrations (repositories, services)
│   │   ├── repositories/    # VS Code implementations
│   │   └── services/        # Technical services
│   │       ├── performance/ # Performance monitoring
│   │       │   ├── MetricsCollectionService.ts
│   │       │   ├── StatisticsCalculationService.ts
│   │       │   └── PerformanceMonitoringService.ts
│   │       ├── caching/     # Caching infrastructure
│   │       │   ├── CacheService.ts
│   │       │   └── WikiCacheService.ts
│   │       ├── ProjectIndexService.ts # Project indexing
│   │       ├── ProjectChangeDetectorService.ts
│   │       ├── GitChangeDetectorService.ts
│   │       ├── EnvironmentMonitoringService.ts
│   │       └── LoggingService.ts # Structured logging
│   ├── llm/                  # LLM provider system
│   │   ├── providers/        # Provider implementations
│   │   ├── prompt.ts         # Prompt building logic
│   │   └── registry.ts       # Provider registry
│   ├── panels/               # VS Code webview panels
│   ├── views/                # VS Code tree views and custom editors
│   │   ├── WikiTreeViewProvider.ts
│   │   └── WikiDocumentProvider.ts
│   ├── providers/            # VS Code language feature providers
│   │   ├── WikiHoverProvider.ts
│   │   ├── WikiCompletionProvider.ts
│   │   └── WikiDiagnosticProvider.ts
│   ├── container/            # Dependency injection
│   ├── constants/            # Application constants
│   │   └── ServiceLimits.ts  # Service configuration limits
│   ├── errors/               # Custom error classes
│   ├── events/               # Event system
│   ├── factories/            # Factory patterns
│   └── utilities/            # Helper functions
├── webview-ui/               # Vue.js webview application
├── docs/                     # Documentation
├── resources/                # Extension resources
└── package.json              # Extension manifest and dependencies
```

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
  async execute(...args: any[]): Promise<any> {
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

### 6. README Automation Workflow

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

### 7. VS Code Language Features

The extension provides VS Code language features for enhanced development experience:

**Features:**

- **Hover Providers**: Show wiki documentation on hover
- **Completion Providers**: Suggest wiki-documented items
- **Diagnostic Providers**: Surface documentation warnings
- **Code Actions**: Quick fixes for documentation issues
- **Document Symbols**: Navigate wiki structure
- **Tree Views**: Browse saved wikis in sidebar
- **Custom Editors**: Edit wiki files with custom UI

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

**Current Process**:

1. Create a provider file under `src/llm/providers/<provider-id>.ts` implementing enhanced `LLMProvider` interface.
2. Create a provider manifest file (`provider.json`) with metadata and capabilities.
3. Place provider files in a discoverable directory (automatic discovery) or register in `src/llm/providers/registry.ts`.
4. No modifications elsewhere. The system discovers and loads providers dynamically.

**Current Capabilities**:

- ✅ Dynamic provider discovery with manifest system
- ✅ Provider lifecycle management (initialize, dispose, health checks)
- ✅ Capability-based provider selection
- ✅ Dependency resolution between providers
- ✅ Hot-reloading without extension restart

**Example provider structure**:

```typescript
// src/llm/providers/newprovider.ts
import { LLMProvider, ProviderConfig, ProviderMetadata } from "../types";

export class NewProvider implements LLMProvider {
  id = "newprovider";
  name = "New Provider";
  requiresApiKey = true;

  async initialize(): Promise<void> {
    // Provider initialization logic
  }

  async dispose(): Promise<void> {
    // Cleanup logic
  }

  async healthCheck(): Promise<HealthCheckResult> {
    // Health check implementation
  }

  getCapabilities(): ProviderCapabilities {
    return {
      maxTokens: 4096,
      supportedLanguages: ["typescript", "python"],
      features: ["streaming", "function-calling"],
      documentationTypes: ["javadoc", "jsdoc", "pydoc"],
      complexity: { min: 1, max: 10 }
    };
  }

  getMetadata(): ProviderMetadata {
    return {
      id: "newprovider",
      name: "New Provider",
      version: "1.0.0",
      description: "A new LLM provider for Qwiki",
      author: "Your Name",
      homepage: "https://github.com/yourname/newprovider",
      capabilities: this.getCapabilities(),
      dependencies: [],
      minQwikiVersion: "2.0.0",
      entryPoint: "./newprovider.js"
    };
  }

  generate: async (prompt, options) => {
    // Provider-specific implementation
  };

  listModels: () => ["model1", "model2"];

  getUiConfig: () => ({
    apiKeyRequired: true,
    customFields: [{ key: "model", label: "Model", type: "select", options: ["model1", "model2"] }],
  });
}
```

**Provider Manifest**:

```json
{
  "id": "newprovider",
  "name": "New Provider",
  "version": "1.0.0",
  "description": "A new LLM provider for Qwiki",
  "author": "Your Name",
  "homepage": "https://github.com/yourname/newprovider",
  "capabilities": {
    "maxTokens": 4096,
    "supportedLanguages": ["typescript", "python"],
    "features": ["streaming", "function-calling"],
    "documentationTypes": ["javadoc", "jsdoc", "pydoc"],
    "complexity": { "min": 1, "max": 10 }
  },
  "dependencies": [],
  "minQwikiVersion": "2.0.0",
  "entryPoint": "./newprovider.js",
  "manifestVersion": "1.0",
  "checksum": "sha256-hash-of-provider-files"
}
```

**Future Vision: Plugin System**:

1. **Provider Self-Registration**: Providers register themselves dynamically
2. **Runtime Discovery**: No core code modifications needed
3. **Capability-Based**: Providers declare their capabilities and requirements
4. **Hot-Pluggable**: Add/remove providers without restarting
5. **Plugin Marketplace**: Third-party provider distribution

## Code Style Guidelines

### 1. General Rules

- No comments in the code (code should be self-explanatory)
- Keep functions small and focused
- Use descriptive variable and function names
- Follow TypeScript best practices
- Use barrel imports for cleaner import statements

### 2. File Organization

- Use index.ts files for barrel exports
- Group related files in directories
- Follow the established naming conventions
- Keep file structure consistent with the architecture

### 3. Error Handling

- Use custom error classes from `src/errors/`
- Implement proper error recovery
- Provide meaningful error messages to users
- Use the global error handler for consistent error processing

## Common Tasks

### 1. Adding a New Command

1. Create command class in `src/application/commands/`
2. Implement the `Command` interface
3. Register the command in `CommandRegistry`
4. Add command to constants
5. Update webview to call the new command

Example:

```typescript
// src/application/commands/NewFeatureCommand.ts
export class NewFeatureCommand implements Command {
  async execute(...args: any[]): Promise<any> {
    // Implementation
  }
}

// Register in CommandRegistry
container.register("newFeatureCommand", () => new NewFeatureCommand());
commandRegistry.register("newFeature", "newFeatureCommand");
```

### 2. Adding a New Service

1. Create service class in `src/application/services/`
2. Define service interface if needed
3. Register service in `AppBootstrap`
4. Inject service where needed

Example:

```typescript
// src/application/services/NewService.ts
export class NewService {
  constructor(private dependency: Dependency) {}

  async performAction(): Promise<Result> {
    // Implementation
  }
}

// Register in AppBootstrap
container.register("newService", () => new NewService(container.get("dependency")));
```

### 3. Adding a New Repository Implementation

1. Create implementation in `src/infrastructure/repositories/`
2. Implement the repository interface from domain layer
3. Register implementation in `AppBootstrap`

Example:

```typescript
// src/infrastructure/repositories/NewRepositoryImpl.ts
export class NewRepositoryImpl implements NewRepository {
  async save(data: Data): Promise<void> {
    // Implementation
  }
}

// Register in AppBootstrap
container.register("newRepository", () => new NewRepositoryImpl());
```

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

- `ContextIntelligenceService`: Main orchestrator
- `FileRelevanceAnalysisService`: Analyzes file relevance
- `FileSelectionService`: Selects optimal files
- `ProjectIndexService`: Maintains project index
- `TokenBudgetCalculatorService`: Calculates token budgets

### 5. Working with README Automation

The README Automation system generates and updates README files from wikis:

Example usage:

```typescript
// In a command
const readmeUpdate = this.container.get<ReadmeUpdateService>("readmeUpdateService");

// Generate preview
const result = await readmeUpdate.updateReadmeFromWikis(wikiIds, {
  providerId,
  model,
  backupOriginal: true,
});

// Result includes preview for user approval
if (result.requiresApproval && result.preview) {
  // Show preview to user in webview
  this.messageBus.postReadmePreview(result.preview);
}
```

**Key Services:**

- `ReadmeUpdateService`: Main orchestrator
- `ReadmeAnalysisService`: Analyzes existing README
- `ReadmeGenerationService`: Generates new content
- `ReadmeBackupService`: Creates backups
- `ReadmeApprovalService`: Manages approval workflow

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

- Commands: `src/application/commands/`
- Services: `src/application/services/`
- Context Intelligence: `src/application/services/context/`
- README Automation: `src/application/services/readme/`
- Repositories: `src/infrastructure/repositories/`
- LLM Providers: `src/llm/providers/`
- Language Features: `src/providers/`
- Tree Views: `src/views/`
- Constants: `src/constants/`
- Error Classes: `src/errors/`
- Webview UI: `webview-ui/src/`
- Loading Store: `webview-ui/src/stores/loading.ts`
- Loading Components: `webview-ui/src/components/features/LoadingState.vue`
- DI Container: `src/container/Container.ts`
- Extension Entry: `src/extension.ts`
- Project Index: `src/infrastructure/services/ProjectIndexService.ts`
- Environment Monitoring: `src/infrastructure/services/EnvironmentMonitoringService.ts`

### Common Patterns

- **Command Pattern**: All user actions
- **Repository Pattern**: Data access
- **Factory Pattern**: Object creation
- **Dependency Injection**: Service management
- **Event System**: Loose coupling
- **Central Loading**: Unified loading state management

### Key Classes

- `CommandRegistry`: Command management
- `Container`: Dependency injection
- `MessageBusService`: Webview communication
- `EventBus`: Event system
- `AppBootstrap`: Application initialization
- `useLoading`: Loading state composable
- `LoadingStore`: Central loading state management
- `ContextIntelligenceService`: Orchestrates optimal context selection
- `ReadmeUpdateService`: Orchestrates README automation workflow
- `LLMRegistry`: Provider discovery and lifecycle management
- `ProviderValidationService`: Validates provider configurations
- `ProjectIndexService`: Maintains project file index
- `EnvironmentMonitoringService`: Real-time health monitoring

Remember: The goal is to maintain clean, modular, and maintainable code following SOLID principles. When in doubt, look at existing implementations for guidance.
