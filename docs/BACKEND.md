# Backend Overview

## Purpose

The backend runs inside the VS Code extension host and orchestrates Qwiki services through clean architecture seams. It owns command execution, dependency wiring, provider management, and persistence while honoring the VS Code extension lifecycle.

## Runtime Stack

- TypeScript targeting the Node.js runtime shipped with VS Code
- VS Code Extension API for workspace access, commands, tree views, and webview hosting
- Clean architecture layering (Presentation → Application → Domain ← Infrastructure)
- Dependency injection via `AppBootstrap` and the lightweight container
- Message bus abstraction for extension ↔ webview communication

## Module Layout

```
src/
  extension.ts             activation entry point
  application/
    bootstrap/             AppBootstrap orchestrator, ServiceRegistrar, InitializationOrchestrator, ReadinessCoordinator
      registrations/       Service registration modules (CoreServiceRegistrations, ContextServiceRegistrations, etc.)
      initializers/        Initialization modules (CriticalServicesInitializer, BackgroundServicesInitializer)
    commands/              Domain-organized commands (core/, providers/, configuration/, wikis/, readme/, utilities/)
    services/              Domain-organized services (core/, context/, configuration/, documentation/, prompts/, readme/, providers/, storage/)
    transformers/          Data transformation layer
    validation/            Validation rules
    CommandRegistry.ts     Command registry with metadata support
  domain/                  entities and repository contracts
  infrastructure/          VS Code integrations, logging, caching, indexing
  llm/                     provider registry, manifests, shared provider types
  panels/                  webview host, message handling, environment monitoring
  providers/               VS Code language feature providers
  views/                   saved wiki views and custom editors
  constants/               command, event, limit, and path definitions
  events/                  event bus interfaces and helpers
  factories/
    commands/              Specialized command factories (CoreCommandFactory, ProviderCommandFactory, etc.)
    CommandFactory.ts      Main orchestrator factory
```

## Core Responsibilities

- Manage activation, service readiness, and background initialization tiers
- Coordinate wiki generation through context services, provider orchestration, and storage
- Persist and retrieve saved wikis through `WikiStorageService`
- Centralize configuration access, validation, migration, and secrets handling
- Maintain the README automation workflow, backup pipeline, and diff-based review flow
- Monitor provider health/performance and validate API keys before execution
- Enforce rate limiting for API calls via `RateLimiterService` integrated into `LLMRegistry`
- Enrich wiki generation with language-server semantics and documentation quality feedback
- Publish structured logs, performance metrics, and environment health signals

## Integration Touchpoints

- Commands are organized by domain (`commands/core/`, `commands/providers/`, etc.) and created via specialized factories (`CoreCommandFactory`, `ProviderCommandFactory`, etc.)
- Commands resolve through `CommandRegistry` with metadata support (grouping, readiness requirements, timeouts) and constants declared in `src/constants`
- All webview messaging flows through `MessageBusService` using event constants
- Service registration is handled by `ServiceRegistrar` with dependency tracking, organized into registration modules
- Initialization is orchestrated by `InitializationOrchestrator` with separate critical and background phases
- Providers are registered by the LLM registry and exposed through `LLMRegistry`
- File system, configuration, and secret access route through repositories to stay VS Code compatible
- Saved wikis flow through `WikiStorageService`, with results surfaced via `savedWikisLoaded`, `wikiSaved`, and `wikiDeleted`
- Language server insights come from `LanguageServerIntegrationService`, which feeds the wiki generation pipeline
- Provider validation, health, and performance data flow through `ProviderValidationService`, `ProviderHealthService`, and `ProviderPerformanceService`
- Rate limiting is enforced via `RateLimiterService` before LLM API calls in `LLMRegistry.generate()`
- Result pattern (`Result<T, E>`) provides type-safe error handling for expected failures in validation and business logic

## See Also

- `docs/ARCHITECTURE.md` for cross-layer design details
- `docs/API_REFERENCE.md` for command payloads, events, and service contracts
- `docs/DEVELOPER_ONBOARDING.md` for build tooling and day-to-day workflows
