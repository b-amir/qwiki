# System Workflows

This document describes the runtime workflows and operational flows of the Qwiki VS Code extension, based on actual system behavior observed during execution.

For architectural details and service catalogs, refer to `docs/ARCHITECTURE.md`.

## Startup Sequence

When you open Qwiki, the extension goes through a carefully orchestrated initialization process designed to make the UI responsive while preparing all services in the background.

**1. Service Registration (< 10ms)**

- All services are registered in the dependency injection container
- Service tiers are defined (critical vs background)
- Command requirements are mapped to services

**2. Critical Services Initialization (0-150ms)**

- Essential services start synchronously to make the UI usable
- `LoggingService`: Structured logging system
- `EventBus`: Event-driven communication
- `ConfigurationManager`: Settings and configuration access
- `MessageBusService`: Webview communication bridge
- `CommandRegistry`: Command execution system
- `TaskSchedulerService`: Priority-based task queue
- `ProjectIndexService.quickInit()`: Loads cached project index (< 100ms)

**Result**: UI becomes interactive in ~150ms. You can navigate, view settings, and select providers immediately.

**3. Background Services Initialization (0-42 seconds)**

- Non-critical services initialize in parallel without blocking the UI
- `ProjectIndexService`: Full project scan (222 files in ~41s)
- `ContextCacheService`: Loads persistent context cache (73 files in 2.4s)
- `ContextIntelligenceService`: Context analysis system
- `ProviderHealthService`: Provider health monitoring (starts with 5-minute interval)

**Result**: Full functionality becomes available after ~42 seconds, but basic operations work immediately.

**4. Project Indexing (Background, 0-41 seconds)**

- Scans workspace for all code files (222 files found)
- Extracts metadata: file types, languages, symbols
- Progress updates: "Indexing progress {processed: 50, total: 222}"
- Caches index to disk for fast future startups
- Sets up Git-based file watchers for incremental updates

**Result**: Project structure is indexed and cached. Future startups load from cache in < 100ms.

**5. Context Cache Warming (Background, Ongoing)**

- `ContextCacheService` loads existing cache (73 files)
- Background cache warming starts for 72 files
- `TaskSchedulerService` processes files in idle time (one every few seconds)
- Each file analyzed: extracts symbols, imports, computes hash
- Cache saved to disk periodically (debounced, every ~1-2 seconds)

**Result**: Context for wiki generation becomes available incrementally. First generation may be slower, subsequent ones use cached context (< 200ms).

**6. Webview Setup (~1 second)**

- Webview HTML content loaded
- `MessageBusService` created for extension ↔ webview communication
- `EnvironmentStatusManager` monitors service readiness
- `NavigationManager` handles page navigation
- Event handlers registered (wiki generation, errors, etc.)
- Command registry created with all commands

**Result**: Webview is fully interactive. You can generate wikis, view settings, and use all features.

**7. User Interaction (After UI Ready)**

- When you open settings: `getApiKeys` and `getProviders` commands execute
- Providers loaded from registry (5 providers, 1 with API key configured)
- Messages batched by `WebviewOptimizerService` for efficiency
- Frontend stores update: settings initialized, providers displayed

**Result**: Settings page shows available providers and their configuration status.

## Key Performance Characteristics

**Fast Startup (< 200ms)**

- Critical services complete in ~150ms
- UI becomes interactive immediately
- Basic navigation and provider selection work right away

**Progressive Enhancement**

- Background services continue initializing after UI is ready
- Project indexing happens in background (41 seconds for 222 files)
- Context cache warms incrementally (one file every few seconds)
- No blocking: user can interact while background work continues

**Smart Caching**

- Project index cached to disk (loads in < 100ms on next startup)
- Context cache persists across sessions (73 files loaded in 2.4s)
- File hashes detect changes automatically
- Only changed files need re-analysis

**Background Processing**

- `TaskSchedulerService` processes files during idle time
- Priority system: user actions (CRITICAL) execute immediately
- Background tasks (LOW/IDLE) run when system is idle
- Batch processing: 50ms max per batch to avoid blocking

## Wiki Generation Workflow

When you select code and click "Generate Wiki", here's the complete flow:

**1. Command Initiation (< 1ms)**

- Frontend sends `generateWiki` command via MessageBus with snippet, file path, and provider
- `WebviewMessageHandler` receives command and checks service readiness
- `CommandRegistry` executes command with 120-second timeout

**2. Context Building (5-6 seconds)**

- **File Context** (cached, ~200ms): Loads from `ContextCacheService` if available
  - Extracts symbols (21 found), imports (7 found)
  - Uses cached data if file hasn't changed
- **Project Context** (5.3 seconds first time, < 1 second cached):
  - Workspace structure loaded from cache (50 files, < 10ms)
  - **Identifier Extraction**: Scans snippet for identifiers (e.g., "currentQuestionNumber")
  - **Text Usage Search** (cached):
    - **First search** (~5.3 seconds): Searches all 222 project files for identifier usage
      - Batched processing: 15 files concurrently
      - Progress updates: 51/222, 100/222, 149/222, 199/222
      - Found 4 related files with matches
      - Results cached with project state hash for invalidation
    - **Cached searches** (< 1 second): Returns cached results instantly
      - Cache key: `textUsageSearch:{token}:{projectStateHash}`
      - Cache TTL: 30 minutes (or until project files change)
      - Automatic invalidation when project state changes
  - **Overview Generation**: Creates project overview (271 chars)

**3. Intelligent Context Selection (0.3 seconds)**

- **Project Type Detection** (cached, 177ms):
  - Detects primary language (JavaScript), framework (Vue)
  - Uses cached project type if available
- **Essential Files** (cached, 14ms):
  - Retrieves 3 essential files (package.json, config files)
- **File Relevance Scoring** (cached, 0ms):
  - Scores 200 indexed files for relevance to target file
  - Top score: 44.18 (package.json)
  - Uses cached scores if available
- **Token Budget Calculation**:
  - Available tokens: 1,047,076 (full context budget)
  - Target utilization: 85%
  - **Effective limit**: 890,014 (85% of available)
  - **File Selection** (single-phase):
    - **Phase 1**: Essential files selected first (3 files, highest priority)
    - **Phase 2**: Regular files selected up to remaining budget
    - Duplicate prevention: Essential files not counted twice if in regular list
  - Total token cost: 412,501 (39% of available, 46% of effective limit)
  - Essential files: Always included (100% inclusion rate)
  - **Note**: Single-phase selection ensures essential files are prioritized and utilization respects 85% target, preventing 100% utilization that risked API failures

**4. Prompt Building (< 1 second)**

- **Loading Steps** (emitted to UI):
  - `validatingProvider`: Provider validation
  - `initializingContext`: Context building (472ms)
  - `analyzingSnippet`: Snippet analysis (10ms)
  - `buildingContextSummary`: Summary creation (17ms)
  - `preparingGenerationInput`: Input preparation (5ms)
  - `buildingPrompt`: Prompt construction (9ms)
  - `validatingPromptQuality`: Quality check (16ms, score: 0.2 - below threshold, 5 suggestions)
  - `collectingSemanticInfo`: Language server integration (61ms)
    - Retrieves symbol info from VS Code language server
    - Symbol: "script setup", kind: 1

**5. LLM Request & Streaming (53 seconds)**

- **Rate Limiting**: Checks provider rate limit (1/10 requests, passed)
- **Request Batching**: Batches request with 100ms delay for deduplication
- **Streaming Request**: Sends request to LLM provider (Z.ai, glm-4.5-flash)
- **Response Streaming**:
  - Waits for streaming response (53.4 seconds)
  - Content streams in chunks to webview in real-time
  - Final response: 874 characters
  - **Time to First Result**: 49.9 seconds (UX metric recorded)

**6. Post-Processing (< 1 second)**

- **Processing Output** (11ms): Processes LLM response
- **Finalizing** (3ms): Final formatting and cleanup
- **Quality Analysis**:
  - Completeness: 0.75
  - Clarity: 0.78
  - Structure: 1.0
  - Examples: 0.75
  - Code References: 1.0
  - **Overall Score**: 0.856 (good quality)
  - Improvement suggestions: 0 (no improvements needed)

**7. Completion & Caching**

- Wiki result published via EventBus
- Results cached for future use
- **Total Duration**: ~55 seconds
- **UX Metrics Recorded**:
  - Time to first result: 49.9 seconds
  - Documentation quality: 0.856
  - Error rate: 0% (1 successful generation)

**8. Saving the Wiki (< 100ms)**

- User clicks "Save"
- `saveWiki` command executes
- Wiki saved to `.qwiki/saved/` folder with timestamp-based filename
- File watcher detects new file
- Tree view refreshes automatically
- Saved wikis count updated (7 → 8)

## README Automation Workflow

When you use saved wikis to update your project's README, here's the complete process:

**1. Navigation & State Check (< 500ms)**

- User navigates to "Saved Wikis" page
- `getSavedWikis` command loads all saved wikis (8 found)
- `checkReadmeBackupState` checks if backup exists (initially: no backup, not synced)

**2. README Update Initiation (< 1 second)**

- User clicks "Update README" button
- `updateReadme` command executes with wiki count (8 wikis)
- `ReadmeWorkflowOrchestrator` starts workflow
- Loading steps begin: `detectingReadmeState`, `creatingBackup`, `generatingReadmeContent`

**3. README State Detection (< 1 second)**

- `ReadmeStateDetectionService` analyzes existing README
- `ReadmeContentAnalysisService` evaluates content:
  - Score: 1.0 (high quality)
  - Is boilerplate: false
  - Is user-contributed: true
  - Generic sections: 0
  - Placeholders: 0
- State detected: `non_existent` (confidence: 1, isBoilerplate: true)
  - Note: System may classify existing README as "non_existent" if it's boilerplate

**4. Backup Creation (< 1 second)**

- `ReadmeBackupService` creates backup before modification
- Backup saved to `.qwiki/backup/README.backup.md`
- File watcher detects backup creation
- Backup state updated: `hasBackup: true`

**5. Project Context Building (2-3 seconds)**

- `ProjectContextService` builds context for README generation:
  - Workspace structure (cache expired, rebuilt: 50 files)
  - Project overview (reads package.json, extracts dependencies)
  - Indexed files (200 files retrieved)
  - Files sample (50 files)
  - Overview length: 271 characters
- Project type detected (cached): JavaScript, Vue framework

**6. Wiki Optimization (< 1 second)**

- `ReadmePromptOptimizationService` optimizes wikis for README:
  - Total wikis: 8
  - Included: 8, Excluded: 0
  - Tokens used: 3,656
  - Tokens available: 109,266
- Provider selected: Cohere (for README generation)
- Rate limit check: Passed (1/10 requests)

**7. README Generation (10-13 seconds)**

- `ReadmePromptBuilderService` builds prompt with project context
- Cache check: Miss (first generation for this wiki set)
- LLM request sent to Cohere provider
- **Generation time**: ~13 seconds
  - Command timeout: 30 seconds
  - Generation completes successfully within timeout
- Content generated and cached for future use

**8. File Writing (< 1 second)**

- README.md file written to project root
- `ReadmeSyncTrackerService` records sync state:
  - Wiki count: 8
  - Backup path recorded
  - State file created: `.qwiki/state/readme-sync.json`
- `readmeSynced` flag set to `true` for all saved wikis

**9. Completion & State Update**

- README update completed successfully
- Saved wikis refreshed: `readmeSynced: true`
- Backup state: `hasBackup: true, readmeSynced: true`
- Notification shown to user

**10. Diff View (< 1 second)**

- User clicks "Show Diff" button
- `showReadmeDiff` command executes
- VS Code diff view opens:
  - Left side: Backup (original README)
  - Right side: Current README (newly generated)
- User can review changes side-by-side

**11. Undo Operation (< 200ms)**

- User clicks "Undo" button
- `undoReadme` command executes
- `ReadmeBackupService` restores README from backup
- `ReadmeSyncTrackerService` clears sync state:
  - Deletes `.qwiki/state/readme-sync.json`
  - Sets `readmeSynced: false` for all wikis
- Backup file deleted: `.qwiki/backup/README.backup.md`
- README restored to original state
- Saved wikis refreshed: `readmeSynced: false`

## Settings & Configuration Workflow

When you configure providers and API keys in the settings page, here's how the system validates and manages your configuration:

**1. Settings Page Load (< 100ms)**

- User navigates to "Settings" page
- `getProviders` command loads all providers (5 providers)
- `getProviderConfigs` command loads provider configurations
- Provider statuses processed:
  - google-ai-studio: 2 models, hasKey: true
  - zai: 7 models, hasKey: true
  - openrouter: 3 models, hasKey: false
  - cohere: 3 models, hasKey: true
  - huggingface: 4 models, hasKey: false
- Frontend stores updated: 5 providers, 3 with keys

**2. Provider Selection (< 10ms)**

- User selects a provider (e.g., OpenRouter)
- `getProviderCapabilities` command retrieves model capabilities
- Capabilities retrieved for all 5 providers (cached)
- Model list displayed (e.g., "openai/gpt-oss-20b")

**3. API Key Entry & Validation**

- User enters API key in settings form
- `validateConfiguration` command runs validation checks
- `saveApiKey` command saves key to SecretStorage:
  - Key stored securely via VS Code SecretStorage API
  - Provider status updated: `hasKey: true`
- Providers refreshed: 4 providers now have keys

**4. Navigation Guard & Validation**

- User attempts to navigate away from settings
- `SettingsNavigationGuard` validates configuration before allowing navigation
- **Validation Checks**:
  - API key format validation
  - Non-ASCII character detection
  - Key length validation
- **Invalid Key Detected**:
  - API key contains non-ASCII characters (3 found)
  - API key length: 28,731 characters (invalid - too long)
  - Navigation blocked: "Settings validation failed, staying on settings"
  - User remains on settings page to fix the issue

**5. Provider Change & Re-validation**

- User changes provider (e.g., to Google AI Studio)
- `getProviderCapabilities` retrieves capabilities for new provider
- User enters correct API key
- `validateApiKeyHealth` command tests API key:
  - Health check request sent to provider
  - Response time: 1,003ms
  - Status: Healthy
  - Validation passed

**6. Successful Navigation**

- Configuration validation passes
- `validateConfiguration` command succeeds
- Navigation allowed: Settings → Homepage
- Frontend updates: `currentPage changed {from: 'settings', to: 'wiki'}`

**7. Configuration State Management**

- API keys stored in VS Code SecretStorage (encrypted)
- Provider configurations cached for fast access
- Health status tracked per provider
- Settings state persisted across sessions

## File Watching & Cache Invalidation

- **Git Integration**: Uses Git extension to detect file changes efficiently
- **Automatic Invalidation**: When files change, cache entries are invalidated
- **Incremental Updates**: Only changed files are re-analyzed
- **Wiki Watcher**: Monitors `.qwiki/saved/` folder for wiki file changes

## Service Readiness System

- **Tiered Services**: Critical (< 500ms) vs Background (< 30s)
- **Command Dependencies**: Commands wait for required services
- **Progress Reporting**: Background initialization progress reported to UI
- **Graceful Degradation**: Commands can execute with degraded functionality if needed
