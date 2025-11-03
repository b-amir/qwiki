# Qwiki

![Qwiki Preview](resources/preview-icon.png)

Qwiki is a local-only VS Code extension that turns code selections into rich project documentation. It blends deep project indexing, provider-aware prompt engineering, automated README maintenance, and a Vue-powered dashboard so teams can capture knowledge without leaving the editor.

## Highlights

- **Context intelligence pipeline**: builds project indexes, ranks related files, and fits the best context into each provider's token budget before any request runs.
- **Provider orchestration**: unified registry with health checks, performance metrics, validation, retry policies, fallback strategies, and configuration introspection across OpenAI, Google AI Studio, Cohere, HuggingFace, OpenRouter, Z.ai, and Gemini variants.
- **Adaptive prompt engineering**: advanced prompt builders, quality scoring, compression, and template controls tailored per provider and workflow.
- **README automation**: analyze, back up, diff, and update README sections using saved wikis, with approval flow, rollback support, and chunked writes.
- **Multi-surface UX**: activity-bar panel, saved wiki tree view, inline hover/completion providers, diagnostics, document symbols, and workspace commands.
- **Observability & resilience**: structured logging, centralized error modal, background task scheduler, memory watchdog, generation caching, batching, debouncing, and environment health telemetry.

## Quick Start

```bash
git clone <repository-url>
cd qwiki
pnpm run install:all
pnpm run build:webview
pnpm run compile
```

Launch the extension by pressing `F5` in VS Code. The development host opens with the Qwiki panel available from the activity bar icon.

## Panel Walkthrough

- **Wiki**: generate documentation, inspect context reasoning, and trigger provider retries. Includes cancellation support and environment readiness checks.
- **Settings**: manage API keys, provider capabilities, configuration templates, backups, and validation feedback.
- **Saved Wikis**: browse generated wikis, open them in editors, or bootstrap README updates.
- **Error History**: review recent failures with structured metadata forwarded from the extension host.

## Command Surface

| Category | Command(s) | Description |
| --- | --- | --- |
| Generation | `generateWiki` | Build documentation with context intelligence, caching, batching, and retries. |
| Context | `getSelection`, `getRelated` | Stream selection metadata and ranked related files to the webview. |
| Provider Ops | `getProviders`, `getProviderConfigs`, `saveApiKey`, `deleteApiKey`, `getProviderCapabilities`, `getProviderHealth`, `getProviderPerformance` | Manage providers, credentials, and health/performance telemetry. |
| Configuration | `getConfiguration`, `updateConfiguration`, `validateConfiguration`, `applyConfigurationTemplate`, `getConfigurationTemplates`, `createConfigurationBackup`, `getConfigurationBackups` | Full configuration lifecycle with validation, templates, and backups. |
| Wiki Storage | `saveWiki`, `getSavedWikis`, `deleteWiki` | Persist and organize generated wikis under `.qwiki`. |
| README Automation | `updateReadme`, `approveReadmeUpdate`, `cancelReadmeUpdate`, `undoReadme`, `checkReadmeBackupState` | Execute automated README updates with preview, approval, and rollback. |
| Panel Utilities | `openFile`, `openExternal`, `saveSetting`, `getApiKeys`, `getEnvironmentStatus` | Panel communication helpers for navigation and notifications. |

VS Code contributes additional shortcuts such as `qwiki.createQuickWiki`, `qwiki.viewSavedWikis`, `qwiki.viewErrorHistory`, `qwiki.cancelActiveRequest`, and a dedicated `qwiki.wikiView` entry.

## Project Layout

```text
src/
  application/
    commands/                 command implementations (generation, provider ops, README flows)
    services/                 context intelligence, prompt pipeline, configuration suite, storage, etc.
    transformers/             pure data transformers
    validation/               provider validation rules
    AppBootstrap.ts           dependency graph and lifecycle wiring
  domain/                     entities and configuration contracts
  infrastructure/
    repositories/             VS Code-backed repositories
    services/                 logging, caching, indexing, performance, background workers
  llm/                        provider registry, manifests, prompts, capability types
  panels/                     webview host, navigation manager, environment monitors
  providers/                  VS Code language features (hover, completions, diagnostics, etc.)
  constants/                  commands, events, limits, loading steps, path patterns
  events/                     event bus and handlers
  views/                      saved wiki tree data provider

webview-ui/
  src/
    App.vue                   top-level navigation and loading orchestration
    components/               layout shell, feature widgets, and page modules
    stores/                   Pinia stores (wiki, settings, environment, navigation, errors, loading)
    composables/              navigation, batching, resizing, provider helpers
    loading/                  shared loading context helpers
    utilities/                VS Code bridge, logging facade, formatting helpers
  vite.config.ts              production build tuned for VS Code webviews
```

## Local Development

- `pnpm run start:webview`: hot reload the Vue application.
- `pnpm run watch`: rebuild the extension host on changes.
- `pnpm run lint`: lint both extension and webview (requires `pnpm dlx eslint`).
- `pnpm run vscode:prepublish`: production build used by VSIX packaging.

All automation scripts rely on Node.js >= 18 and pnpm >= 8.

## Provider Configuration & Secrets

- API keys are stored via VS Code `SecretStorage` (`qwiki:apikey:<providerId>`).
- Provider models, fallback chains, and metadata are read from the configuration manager, which supports templates, migration to version `1.4.0`, and backups.
- Provider validation surfaces actionable warnings in Settings before a generation runs.

## README Automation Workflow

1. **Analyze** existing README structure, detect custom sections, and snapshot current content.
2. **Compose** candidate sections using saved wikis and wiki summarization.
3. **Preview & approval**: the panel displays a diff, allows cancellations, and requires approval when configured.
4. **Backup & write**: chunked writes with automatic backup and optional rollback.

Events such as `readmeUpdateProgress`, `readmeBackupCreated`, and `readmeUpdateApproved` keep the webview in sync during the process.

## Telemetry & Diagnostics

- Structured logging through `LoggingService` for the extension and `createLogger` in the webview.
- Provider metrics captured via `MetricsCollectionService`, `StatisticsCalculationService`, and `PerformanceMonitoringService` feed the provider performance dashboard.
- The environment store tracks language server readiness, background task saturation, and provider health so the panel can warn before a generation starts.

## Further Reading

- **[Architecture](docs/ARCHITECTURE.md)**: Clean architecture overview, service catalog, and data flow diagrams.
- **[Developer Onboarding](docs/DEVELOPER_ONBOARDING.md)**: Workstation setup, debugging tips, and contribution workflow.
- **[Backend Guide](docs/BACKEND.md)**: Extension-host best practices, activation, disposal, and memory management.
- **[Frontend Guide](docs/FRONTEND.md)**: Vue performance tactics, loading framework, and batching protocol.
- **[Design System](docs/DESIGN_SYSTEM.md)**: Tailwind theme tokens and UI conventions.
- **[API Reference](docs/API_REFERENCE.md)**: Commands, message payloads, and provider contracts.

---

Qwiki keeps every request local to your editor, giving teams production-grade documentation workflows without leaving VS Code.
