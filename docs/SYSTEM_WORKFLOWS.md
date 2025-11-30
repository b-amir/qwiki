# System Workflows

This document describes the runtime workflows and operational flows of the Qwiki VS Code extension. It explains how the system behaves during normal operation.

For architectural details and service catalogs, refer to `docs/ARCHITECTURE.md`.

## Startup Sequence

When the extension activates, it initializes services in a tiered sequence designed to make the UI responsive while preparing functionality in the background.

### Service Registration

All services register in the dependency injection container. Service tiers define which services are critical for UI responsiveness versus those that can initialize in the background. Command requirements map to their service dependencies.

### Critical Services Initialization

Essential services start synchronously to make the UI usable immediately:

- `LoggingService`: Structured logging system
- `EventBus`: Event-driven communication infrastructure
- `ConfigurationManager`: Settings and configuration access
- `MessageBusService`: Webview communication bridge
- `CommandRegistry`: Command execution system
- `TaskSchedulerService`: Priority-based task queue
- `ProjectIndexService`: Quick initialization loads cached project index

The UI becomes interactive once these services complete. Users can navigate, view settings, and select providers immediately.

### Background Services Initialization

Non-critical services initialize in parallel without blocking the UI:

- `ProjectIndexService`: Performs full project scan for all code files
- `ContextCacheService`: Loads persistent context cache from disk
- `ContextIntelligenceService`: Context analysis system initialization
- `ProviderHealthService`: Provider health monitoring with periodic checks

Full functionality becomes available after background initialization completes, but basic operations work immediately.

### Project Indexing

The system scans the workspace for all code files and extracts metadata including file types, languages, and symbols. Progress updates indicate indexing status. The index caches to disk for fast future startups. Git-based file watchers enable incremental updates when files change.

Future startups load the cached index quickly without full re-scanning.

### Context Cache Warming

`ContextCacheService` loads existing cache files from disk. Background cache warming processes files incrementally. Source files in `src/` directories receive priority over other files like `dist/` or configuration files. Files process in batches for efficiency, with `TaskSchedulerService` scheduling batches as low-priority background tasks.

Each file analysis extracts symbols, imports, and computes content hashes. Batches complete incrementally, and the cache saves to disk periodically with debouncing.

Context for wiki generation becomes available incrementally. Source files analyze first to improve cache hit rates for common wiki generation scenarios. First generation may be slower, while subsequent generations use cached context.

### Webview Setup

The webview HTML content loads, `MessageBusService` creates the extension-to-webview communication bridge, and `EnvironmentStatusManager` monitors service readiness. `NavigationManager` handles page navigation, and event handlers register for wiki generation, errors, and other operations. The command registry creates with all available commands.

The webview is fully interactive at this point. Users can generate wikis, view settings, and use all features.

### User Interaction

When users open settings, `getApiKeys` and `getProviders` commands execute. Providers load from the registry, and messages batch by `WebviewOptimizerService` for efficiency. Frontend stores update with settings initialized and providers displayed.

## Performance Characteristics

### Fast Startup

Critical services complete quickly, making the UI interactive within a short time window. Basic navigation and provider selection work immediately.

### Progressive Enhancement

Background services continue initializing after the UI is ready. Project indexing happens in the background, context cache warms incrementally, and no blocking occurs. Users can interact while background work continues.

### Smart Caching

The project index caches to disk and loads quickly on subsequent startups. Context cache persists across sessions. File hashes detect changes automatically, and only changed files require re-analysis.

### Background Processing

`TaskSchedulerService` processes files during idle time. The priority system ensures user actions execute immediately, while background tasks run when the system is idle. Batch processing limits work per batch to avoid blocking.

## Wiki Generation Workflow

When users select code and initiate wiki generation, the system follows this flow:

### Command Initiation

The frontend sends a `generateWiki` command via MessageBus with the code snippet, file path, and provider selection. `WebviewMessageHandler` receives the command and checks service readiness. `CommandRegistry` executes the command with a configurable timeout.

### Context Building

The system builds context from multiple sources, prioritizing cached data when available.

**File Context**: Loads from `ContextCacheService` if available. Extracts symbols and imports from the target file. Uses cached data if the file has not changed since last analysis.

**Project Context**: Builds comprehensive project context including workspace structure, identifier usage, and project overview. Workspace structure uses a shared cache with time-to-live expiration. Cached builds reuse structure from previous operations. The cache shares between wiki generation and README generation workflows.

Identifier extraction scans the code snippet for identifiers. Text usage search scans project files for identifier usage, processing files in batches for efficiency. Results cache with project state hash for automatic invalidation. Cached searches return instantly when available.

Overview generation creates a project overview summary.

### Intelligent Context Selection

The system selects relevant files using intelligent scoring and prioritization.

**Project Type Detection**: Detects primary language and framework, using cached detection when available.

**Essential Files**: Retrieves essential configuration files like package.json and config files.

**File Relevance Scoring**: Scores all indexed files for relevance to the target file. Uses cached scores when available to avoid recomputation.

**Token Budget Calculation**: Calculates available tokens from the provider's context limit. Applies a target utilization percentage. Essential files always included with highest priority. Regular files selected up to remaining budget, with duplicate prevention ensuring essential files are not counted twice.

### Prompt Building

The system builds the generation prompt with multiple validation steps. Loading steps emit progress to the UI:

- Provider validation
- Context initialization
- Snippet analysis
- Context summary creation
- Generation input preparation
- Prompt construction
- Quality validation with automatic improvement
- Semantic information collection from language server

Quality validation includes automatic improvement that applies high and medium priority suggestions to enhance prompt clarity, completeness, specificity, consistency, and structure. Safety suggestions cannot be auto-improved. The system blocks generation only if quality remains below threshold after improvement attempts.

Language server integration retrieves symbol information from VS Code's language server for enhanced context.

### LLM Request and Streaming

Rate limiting checks the provider's rate limit status. Request batching uses a delay for deduplication. The streaming request sends to the selected LLM provider. Response content streams in chunks to the webview in real-time. The system tracks time to first result as a user experience metric.

### Post-Processing

The system processes the LLM response, performs final formatting and cleanup, and runs quality analysis on the generated content. Quality metrics include completeness, clarity, structure, examples, and code references. An overall quality score indicates documentation quality. Improvement suggestions identify areas for enhancement if needed.

### Completion

Wiki results publish via EventBus, and results cache for future use. User experience metrics record including time to first result, documentation quality, and error rates.

### Saving the Wiki

When users click save, the `saveWiki` command executes. The wiki saves to the `.qwiki/saved/` folder with a timestamp-based filename. A file watcher detects the new file, and the tree view refreshes automatically. Saved wikis count updates accordingly.

## README Automation Workflow

When users update the project README using saved wikis, the system follows this process:

### Navigation and State Check

Users navigate to the "Saved Wikis" page. The `getSavedWikis` command loads all saved wikis. `checkReadmeBackupState` checks if a backup exists and sync status. In-memory caching with short time-to-live prevents redundant I/O operations. Cache automatically invalidates on backup or README update events.

### README Update Initiation

Users click the "Update README" button. The `updateReadme` command executes with the wiki count. `ReadmeWorkflowOrchestrator` starts the workflow. Loading steps begin indicating state detection, backup creation, and content generation phases.

### README State Detection

`ReadmeStateDetectionService` analyzes the existing README. `ReadmeContentAnalysisService` evaluates content quality, boilerplate detection, user contribution indicators, generic sections, and placeholders. State detection classifies the README as non-existent, boilerplate, or user-contributed based on analysis. User-contributed READMEs receive special handling to prevent accidental overwrites. Git analysis considers commit history when available.

### Safety Check and Backup Creation

For user-contributed READMEs, the system logs warnings and publishes events. The system proceeds with backup and generation. `ReadmeBackupService` creates a backup before modification, saving to `.qwiki/backup/README.backup.md`. Event publication triggers cache invalidation. File watchers detect backup creation and update backup state. State check cache invalidates to ensure fresh state on next check.

### Project Context Building

`ProjectContextService` builds context for README generation. Workspace structure reuses shared cache from wiki generation when available. Project type detection uses cached results. Context sharing between wiki and README workflows eliminates duplicate work.

### Wiki Optimization

`ReadmePromptOptimizationService` optimizes wikis for README inclusion. The system selects wikis within token budget constraints, tracking tokens used versus available. Provider selection occurs for README generation, and rate limit checks pass before proceeding.

### README Generation

`ReadmePromptBuilderService` builds the prompt with project context. Cache checks occur before generation. The LLM request sends to the selected provider. Generation time varies by wiki count and complexity. Content generates and caches for future use.

### File Writing

The README.md file writes to the project root. `ReadmeSyncTrackerService` records sync state including wiki count, backup path, and state file creation in `.qwiki/state/readme-sync.json`. The `readmeSynced` flag sets to true for all saved wikis.

### Completion and State Update

README update completes successfully. Saved wikis refresh with updated sync status. Backup state reflects completion. Users receive notification of completion.

### Diff View

Users can click "Show Diff" to open a VS Code diff view comparing the backup to the newly generated README side-by-side for review.

### Undo Operation

Users can click "Undo" to restore the README from backup. `ReadmeBackupService` restores the file, and `ReadmeSyncTrackerService` clears sync state. Backup file deletion occurs, and saved wikis refresh with `readmeSynced` set to false. Cache invalidates to ensure fresh state.

## Settings and Configuration Workflow

When users configure providers and API keys in the settings page, the system validates and manages configuration as follows:

### Settings Page Load

Users navigate to the "Settings" page. The `getProviders` command loads all available providers. The `getProviderConfigs` command loads provider configurations. Provider statuses process including model counts and API key presence indicators. Frontend stores update with provider information.

### Provider Selection

Users select a provider to configure. The `getProviderCapabilities` command retrieves model capabilities. Capabilities retrieve for all providers with caching for performance. Model lists display with available options.

### API Key Entry and Validation

Users enter API keys in the settings form. The `validateConfiguration` command runs validation checks. The `saveApiKey` command saves keys securely to SecretStorage using VS Code's SecretStorage API. Provider status updates reflect key configuration. Providers refresh to show updated status.

### Navigation Guard and Validation

When users attempt to navigate away from settings, `SettingsNavigationGuard` validates configuration before allowing navigation. Validation checks include API key format validation, non-ASCII character detection, and key length validation. If invalid keys are detected, navigation blocks and users remain on the settings page to fix issues.

### Provider Change and Re-validation

Users can change provider selection. The `getProviderCapabilities` command retrieves capabilities for the new provider. Users enter API keys, and the `validateApiKeyHealth` command tests API key validity. Health check requests send to the provider, and validation results indicate status.

### Successful Navigation

When configuration validation passes, the `validateConfiguration` command succeeds. Navigation proceeds to other pages. Frontend updates track page transitions.

### Configuration State Management

API keys store in VS Code SecretStorage with encryption. Provider configurations cache for fast access. Health status tracks per provider. Settings state persists across sessions.

## File Watching and Cache Invalidation

The system uses Git integration to detect file changes efficiently. When files change, cache entries invalidate automatically. Only changed files require re-analysis through incremental updates. A wiki watcher monitors the `.qwiki/saved/` folder for wiki file changes.

## Service Readiness System

Services initialize in tiers based on criticality. Critical services must initialize quickly for UI responsiveness, while background services have more time. Commands wait for required services to become ready. Progress reporting communicates background initialization status to the UI. The system gracefully degrades if services are unavailable, allowing commands to execute with reduced functionality when appropriate.
