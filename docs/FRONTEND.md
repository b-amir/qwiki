# Frontend Overview

## Purpose

The frontend is a Vue-based VS Code webview that delivers Qwiki’s interactive experience. It renders documentation workflows, configuration panels, readiness indicators, and saved wikis while remaining synchronized with the extension host via the message bus.

## Technology Stack

- Vue 3 with `<script setup>` Composition API
- TypeScript for strict typing and shared model parity
- Pinia for application state management
- Tailwind CSS design tokens aligned with VS Code theme variables
- Vite for bundling, code splitting, and hot-module reload

## Module Layout

```
webview-ui/
  src/
    App.vue                root shell and navigation scaffolding
    components/            layout, page, feature, and base UI components
    stores/                Pinia stores for wiki, settings, environment, navigation, errors, loading
    composables/           navigation, loading, messaging, logging, error helpers
    utilities/             VS Code bridge, formatting, markdown, logging facade
    loading/               centralized loading context definitions
    styles/                Tailwind configuration and theme bindings
  vite.config.ts           build configuration tuned for VS Code webviews
```

## Key Responsibilities

- Present wiki generation, saved wiki management, settings, and error history views
- Bridge extension messages through `useVscodeMessaging` and `useBatchMessageBridge`
- Apply centralized loading, navigation, and error stores for consistent UX
- Reflect environment readiness, provider status, and README automation progress

## Design Alignment

- UI components conform to the Tailwind-based design system in `docs/DESIGN_SYSTEM.md`
- Layouts account for narrow sidebar widths and scale up with max-width constraints
- Accessibility relies on focus-visible styles, ARIA patterns, and keyboard-friendly controls

## See Also

- `docs/ARCHITECTURE.md` for cross-layer coordination details
- `docs/API_REFERENCE.md` for message contracts and command payloads
- `docs/DESIGN_SYSTEM.md` for styling, spacing, and accessibility requirements
