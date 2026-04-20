# Qwiki

<p align="center">
  <img src="https://raw.githubusercontent.com/b-amir/qwiki/main/resources/preview-icon.png" alt="Qwiki Icon" width="120" />
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/b-amir/qwiki/main/resources/infographic.png" alt="Qwiki Infographic" width="100%" />
</p>

Qwiki is a local-only VS Code extension that turns code selections into living project documentation. It combines deep project indexing, context-aware provider orchestration, adaptive prompt engineering, and a Vue-powered dashboard so teams can document code without leaving the editor.

## Core Capabilities

- **Service readiness pipeline** keeps the UI responsive by initializing critical services in under 500ms and deferring background work with progress reporting.
- **Context intelligence pipeline** builds project indexes, ranks related files, and assembles token-aware context for each provider request.
- **Provider orchestration** unifies health checks, performance metrics, validation, retry policies, and fallback logic across Google AI Studio, OpenRouter, Cohere, Hugging Face, and Z.ai integrations.
- **Adaptive prompt engineering** applies provider-specific templates, compression, and quality scoring to generate consistent documentation output.
- **Documentation quality feedback** captures semantic insights from language servers, scores generated content, and suggests improvements before caching the wiki.
- **README automation** analyzes existing content, prepares wiki-backed updates, captures approvals, and writes changes with automatic backups.
- **Multi-surface UX** spans the activity-bar panel, saved wiki tree view, inline hover/completion providers, diagnostics, and workspace commands.

## Quick Start

```bash
git clone <repository-url>
cd qwiki
pnpm run install:all
pnpm run build:webview
pnpm run compile
```

Launch the extension by pressing `F5` in VS Code. A development host opens with the Qwiki panel accessible from the activity bar. Configure an LLM provider in the panel settings before generating documentation.

## Everyday Workflow

1. Open a project in the extension development host.
2. Select the code you want documented or open a file.
3. Trigger `Qwiki: Generate Wiki` from the command palette or the panel.
4. Review the generated documentation, save it to the wiki tree, or apply it to the README workflow.

## Project Layout

```text
src/
  application/          commands, services, transformers, validation, AppBootstrap
  domain/               entities and repository interfaces
  infrastructure/       repositories, logging, caching, indexing, background services
  llm/                  provider registry, manifests, prompts, capability types
  panels/               webview host, navigation, environment monitoring
  providers/            language feature providers (hover, completions, diagnostics)
  constants/            commands, events, limits, path patterns
  views/                saved wiki tree and related views

webview-ui/
  src/                  Vue application (App.vue, components, stores, composables, utilities)
  vite.config.ts        production build tuned for VS Code webviews
```

## Learn More

- [Architecture](./docs/ARCHITECTURE.md) — clean architecture overview, service catalog, and data flow diagrams
- [API Reference](./docs/API_REFERENCE.md) — command surface, message payloads, and provider contracts
- [Developer Onboarding](./docs/DEVELOPER_ONBOARDING.md) — workstation setup, debugging tips, and contribution workflow
- [Backend Guide](./docs/BACKEND.md) — extension-host operational guidance and VS Code best practices
- [Frontend Guide](./docs/FRONTEND.md) — Vue webview performance guidance and batching protocol
- [Design System](./docs/DESIGN_SYSTEM.md) — Tailwind theme tokens, accessibility, and UI conventions
- [System Workflows](./docs/SYSTEM_WORKFLOWS.md) — end-to-end operational flows and lifecycle behavior
- [SOLID Principles](./docs/SOLID_PRINCIPLES.md) — architecture constraints and maintainability guidelines

---

Qwiki keeps every request local to your editor, delivering production-grade documentation workflows entirely within VS Code.
