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
- Optimize rendering performance with virtual scrolling, shallow reactivity, and memoization
- Display enhanced loading progress with percentages, time estimates, and contextual messages

## Design Alignment

- UI components conform to the Tailwind-based design system in `docs/DESIGN_SYSTEM.md`
- Layouts account for narrow sidebar widths and scale up with max-width constraints
- Accessibility relies on focus-visible styles, ARIA patterns, and keyboard-friendly controls

## Performance Optimizations

The frontend includes several performance optimizations for handling large datasets and improving rendering efficiency:

**Virtual Scrolling**:

- Large lists (100+ items) use virtual scrolling to reduce DOM nodes from 1000+ to <100
- Only visible items are rendered, improving initial load time and scroll performance
- Applied to saved wikis list and other large file lists

**Shallow Reactivity**:

- Large immutable datasets use `shallowRef` and `shallowReactive` instead of deep reactivity
- Reduces reactivity overhead by 30-50% for large collections
- Deep reactivity preserved only where needed (form inputs, editable data)

**Memoization**:

- `v-memo` directive applied to expensive list items to prevent unnecessary re-renders
- Memo dependencies specified to control when re-rendering occurs
- Reduces rendering overhead for frequently updated lists

**Component Optimization**:

- Lazy loading for heavy components
- Code-splitting by route for faster initial load
- Event handler optimization and debounced scroll events

**Loading Progress Enhancements**:

- Progress percentages displayed for each loading step
- Estimated time remaining based on historical performance
- Contextual progress messages with relevant information (file counts, token usage, etc.)
- Enhanced progress bar visualization with smooth updates

## See Also

- `docs/ARCHITECTURE.md` for cross-layer coordination details
- `docs/API_REFERENCE.md` for message contracts and command payloads
- `docs/DESIGN_SYSTEM.md` for styling, spacing, and accessibility requirements
