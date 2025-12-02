# Design System for Qwiki Webview

This document provides design system guidelines for AI agents working on the Qwiki VS Code extension webview. The stack and structural overview for the webview lives in `docs/FRONTEND.md`; this guide focuses on styling and interaction patterns to keep the experience minimal, clean, and consistent with VS Code.

## Core Principles

1. **Minimal**: Avoid unnecessary complexity and visual clutter
2. **Clean**: Maintain clear visual hierarchy and spacing
3. **Consistent**: Use standardized components and patterns throughout
4. **VS Code Native**: Integrate seamlessly with VS Code's look and feel

## Technology Stack

- **Framework**: Vue.js 3 (Composition API)
- **Styling**: Tailwind CSS with custom theme variables
- **UI Components**: Custom shadcn-vue style components
- **State Management**: Pinia stores
- **Build Tool**: Vite

## VS Code Theme Integration

### Color System

**CRITICAL**: All colors MUST come from VS Code theme variables. Never use hardcoded colors.

The color system is defined in `webview-ui/src/style.css` using CSS custom properties that map to VS Code theme tokens.

#### Available Color Variables

```css
/* Core Colors */
--background: var(
    --vscode-sideBar-background,
    var(--vscode-panel-background, var(--vscode-editor-background))
  )
  --foreground: var(--vscode-foreground) /* Muted/Secondary */
  --muted: var(--vscode-input-background) --muted-foreground: var(--vscode-descriptionForeground)
  /* Interactive Elements */ --primary: var(--vscode-foreground)
  --primary-foreground: var(--vscode-sideBar-background)
  --secondary: var(--vscode-button-secondaryBackground, var(--vscode-button-background))
  --secondary-foreground: var(--vscode-button-secondaryForeground, var(--vscode-button-foreground))
  --accent: var(--vscode-toolbar-hoverBackground) --accent-foreground: var(--vscode-foreground)
  /* Borders & Focus */ --border: var(--vscode-panel-border) --input: var(--vscode-input-border)
  --ring: var(--vscode-focusBorder) /* Cards & Popovers */
  --card: var(--vscode-editorWidget-background)
  --card-foreground: var(--vscode-editorWidget-foreground)
  --popover: var(--vscode-editorWidget-background)
  --popover-foreground: var(--vscode-editorWidget-foreground) /* States */
  --destructive: var(--vscode-errorForeground)
  --destructive-foreground: var(--vscode-editor-background)
  --link: var(--vscode-textLink-foreground) --link-hover: var(--vscode-textLink-activeForeground)
  --selection-bg: var(--vscode-editor-selectionBackground)
  --selection-fg: var(--vscode-editor-selectionForeground) --focus-ring: var(--vscode-focusBorder)
  /* Scrollbars */ --scrollbar-bg: var(--vscode-scrollbarSlider-background)
  --scrollbar-bg-hover: var(--vscode-scrollbarSlider-hoverBackground)
  --scrollbar-bg-active: var(--vscode-scrollbarSlider-activeBackground);
```

#### Usage in Components

Use Tailwind CSS classes that reference these variables:

```vue
<!-- Good: Uses theme variables -->
<div class="bg-background text-foreground">
  <button class="bg-primary text-primary-foreground hover:bg-accent">
    Click me
  </button>
</div>

<!-- Bad: Hardcoded colors -->
<div style="background: #ffffff; color: #000000">
  <button style="background: #007acc">
    Click me
  </button>
</div>
```

#### Theme Detection

The theme is automatically detected in `webview-ui/src/main.ts`:

```typescript
function applyVscodeThemeClass() {
  const body = document.body;
  const isLight =
    body.classList.contains("vscode-light") ||
    body.classList.contains("vscode-high-contrast-light");
  const isDark =
    body.classList.contains("vscode-dark") || body.classList.contains("vscode-high-contrast");
  document.documentElement.classList.toggle("dark", isDark && !isLight);
  document.documentElement.style.colorScheme = isLight ? "light" : "dark";
}
```

### VS Code Theme Color Tokens Reference

VS Code automatically injects theme colors as CSS variables. Commonly used tokens include:

**Background Colors:**

- `--vscode-editor-background`
- `--vscode-sideBar-background`
- `--vscode-panel-background`
- `--vscode-input-background`
- `--vscode-editorWidget-background`

**Foreground Colors:**

- `--vscode-foreground`
- `--vscode-descriptionForeground`
- `--vscode-input-foreground`
- `--vscode-editorWidget-foreground`

**Interactive Elements:**

- `--vscode-button-background`
- `--vscode-button-foreground`
- `--vscode-button-hoverBackground`
- `--vscode-button-secondaryBackground`
- `--vscode-button-secondaryForeground`

**Border & Focus:**

- `--vscode-panel-border`
- `--vscode-input-border`
- `--vscode-focusBorder`

**States:**

- `--vscode-errorForeground`
- `--vscode-warningForeground`
- `--vscode-textLink-foreground`
- `--vscode-textLink-activeForeground`

**Scrollbars:**

- `--vscode-scrollbarSlider-background`
- `--vscode-scrollbarSlider-hoverBackground`
- `--vscode-scrollbarSlider-activeBackground`

For a complete list, refer to [VS Code Theme Color Reference](https://code.visualstudio.com/api/references/theme-color).

## UI Components

### Component Architecture

Components follow a shadcn-vue pattern with:

- **Base components** in `webview-ui/src/components/ui/`
- **Feature components** in `webview-ui/src/components/features/`
- **Page components** in `webview-ui/src/components/pages/`
- **Layout components** in `webview-ui/src/components/layout/`

### Standard Component Patterns

#### Button Component

Located at `webview-ui/src/components/ui/button.vue`.

**⚠️ CRITICAL: When to Use Button Component vs Plain Text Buttons**

**Use Button Component ONLY for:**

- Primary actions (e.g., "Generate Wiki", "Save", "Submit")
- Destructive actions that need emphasis (use with caution)
- Full-width action buttons in forms

**Use Plain Text Buttons for:**

- Secondary actions (Refresh, Delete, Cancel, etc.)
- Navigation actions (Back, Settings, etc.)
- Inline actions within lists/cards
- Small utility actions

**Plain Text Button Pattern:**

```vue
<!-- Good: Subtle text button for secondary actions -->
<button class="text-muted-foreground hover:text-muted-foreground/80 text-sm">
  Refresh
</button>

<button class="text-destructive hover:text-destructive/80 text-xs">
  Delete
</button>

<!-- Bad: Button component for small secondary actions -->
<Button variant="ghost" size="sm">Refresh</Button>
```

**Button Component Variants:**

- `default`: Primary action button (use sparingly)
- `outline`: Secondary action with border (use sparingly)
- `ghost`: Minimal hover state, no background (use sparingly)

**Button Component Sizes:**

- `default`: Standard height (h-9) - for primary actions only
- `sm`: Small (h-8) - avoid unless absolutely necessary
- `lg`: Large (h-10) - avoid in narrow panels
- `icon`: Square icon button (h-9 w-9)

**Usage Guidelines:**

```vue
<!-- Good: Primary action uses Button component -->
<Button class="mx-auto w-full max-w-md">Generate Wiki</Button>

<!-- Good: Secondary actions use plain text buttons -->
<button class="text-muted-foreground hover:text-muted-foreground/80 text-sm">
  Refresh
</button>
<button class="text-destructive hover:text-destructive/80 text-xs">
  Delete
</button>

<!-- Bad: Overuse of Button component -->
<Button variant="ghost" size="sm">Refresh</Button>
<Button variant="ghost" size="sm">Delete</Button>
```

#### Card Component

Located at `webview-ui/src/components/ui/card/`.

**Structure:**

- `Card`: Container with background, border, shadow
- `CardHeader`: Header section
- `CardTitle`: Title text
- `CardDescription`: Subtitle/description
- `CardContent`: Main content area
- `CardFooter`: Footer section

**Usage:**

```vue
<script setup>
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>Card Title</CardTitle>
      <CardDescription>Card description</CardDescription>
    </CardHeader>
    <CardContent> Main content here </CardContent>
    <CardFooter> Footer actions </CardFooter>
  </Card>
</template>
```

### Typography

Use VS Code's font stack (defined in `style.css`):

```css
font-family:
  ui-sans-serif,
  system-ui,
  -apple-system,
  Segoe UI,
  Roboto,
  Ubuntu,
  Cantarell,
  Noto Sans,
  sans-serif;
```

**Heading Styles (in prose context):**

- `h1`: `text-xl font-semibold mb-2 mt-2`
- `h2`: `text-lg font-semibold mb-2 mt-4 tracking-wide`
- `h3`: `text-base text-muted-foreground mb-2 mt-3 tracking-wide`

**Body Text:**

- Default: Uses `text-foreground`
- Muted: Uses `text-muted-foreground`
- Small: Add `text-sm` class

### Spacing System

Follow Tailwind's spacing scale (0.25rem increments):

- `p-2`, `px-3`, `py-4` for padding
- `m-2`, `mx-3`, `my-4` for margins
- `gap-2`, `gap-4` for flex/grid gaps

**Common Patterns:**

- Card padding: `p-4` or `p-6`
- Button padding: `px-4 py-2` (default), `px-3` (small)
- Section spacing: `py-3` for headers, `my-2` for content sections

### Borders & Radius

- **Border color**: Always use `border-border` class (uses `--border` variable)
- **Border radius**: Use `rounded-lg` (defined by `--radius: 0.5rem` in CSS)
  - Alternative sizes: `rounded-md`, `rounded-sm` (calculated from `--radius`)

### Focus States

**CRITICAL**: All interactive elements MUST have focus styles for accessibility.

```vue
<!-- Good: Includes focus-visible styles -->
<button class="focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2">
  Click me
</button>

<!-- Bad: No focus indication -->
<button>Click me</button>
```

Standard focus pattern (already applied in button component):

- `focus-visible:outline-none`
- `focus-visible:ring-2`
- `focus-visible:ring-ring` (uses `--focus-ring` / `--vscode-focusBorder`)

## Responsiveness

**CRITICAL**: The webview is a **narrow vertical VS Code panel** that must function perfectly across all sizes. This constraint influences every design decision.

### Panel Constraints

- **Typical Width**: 1/4 to 1/5 of screen width (approximately 320-400px on laptop screens)
- **Orientation**: Vertical, narrow
- **Resizable**: Users can resize from narrow (~200px) to fullscreen
- **Functional Requirement**: Must be readable and usable at all sizes

### Core Responsiveness Principles

1. **Never assume wide horizontal space** - Design for narrow vertical layout first
2. **Prevent cramped layouts** - Use appropriate spacing and sizing
3. **Avoid text overflow** - Truncate or wrap text intelligently
4. **Max-width for fullscreen** - Full-width elements need reasonable maximums
5. **Vertical stacking** - Prefer vertical over horizontal layouts
6. **Readable at minimum** - Ensure text and controls are readable at ~200px width

### Width Constraints

**Full-Width Elements Must Have Max-Width:**

```vue
<!-- Good: Full-width with max-width for fullscreen -->
<button class="mx-auto w-full max-w-md">Action</button>
<input class="w-full max-w-md" />

<!-- Bad: Unbounded full-width -->
<button class="w-full">Action</button>
<input class="w-full" />
```

**Recommended Max-Widths:**

- Buttons: `max-w-md` (28rem / ~448px) or `max-w-sm` (24rem / ~384px)
- Inputs: `max-w-md` or `max-w-sm`
- Cards: `max-w-lg` (32rem / ~512px) for fullscreen
- Containers: Use `container` class with max-width, or `max-w-2xl` (42rem / ~672px)

### Typography Sizing

**Font Sizes for Narrow Panels:**

- **Headings**: Use smaller sizes (`text-lg` for h1, `text-base` for h2, `text-sm` for h3)
- **Body Text**: `text-sm` (14px) minimum for readability
- **Labels**: `text-xs` or `text-sm`
- **Avoid**: `text-xl` or larger for body content (except headings with max-width constraint)

```vue
<!-- Good: Appropriate sizing for narrow panel -->
<h1 class="text-lg font-semibold">Page Title</h1>
<p class="text-sm">Body text content</p>
<span class="text-muted-foreground text-xs">Helper text</span>

<!-- Bad: Too large for narrow panel -->
<h1 class="text-2xl font-semibold">Page Title</h1>
<p class="text-base">Body text content</p>
```

### Spacing Adjustments

**⚠️ CRITICAL: Minimum Spacing Requirements**

**NEVER use cramped spacing. Always use these minimums:**

- **Page/Section Headers**: `px-4 py-4` minimum (NOT `py-3` or less)
- **Card padding**: `p-4` minimum (NOT `p-3`)
- **Section padding**: `px-4` horizontal, `py-3` or `py-4` vertical minimum
- **Gap spacing**: `gap-3` minimum between sections, `gap-2` minimum between related items
- **Element spacing**: `mt-4` minimum between header and content (NOT `mt-3` or less)
- **Empty states**: `py-6` minimum vertical padding

```vue
<!-- Good: Proper spacing that doesn't feel cramped -->
<div class="border-b px-4 py-4">
  <h1>Page Title</h1>
  <div class="mt-4">
    <input />
  </div>
</div>

<div class="p-4">
  <div class="flex flex-col gap-3">
    <!-- Content -->
  </div>
</div>

<!-- Bad: Cramped spacing -->
<div class="border-b px-4 py-3">
  <h1>Page Title</h1>
  <div class="mt-3">
    <input />
  </div>
</div>

<div class="p-3">
  <div class="flex flex-col gap-2">
    <!-- Content -->
  </div>
</div>
```

### Text Handling

**Text Truncation:**

Always truncate long text that might overflow:

```vue
<!-- Good: Truncated with ellipsis -->
<div class="truncate">{{ longTitle }}</div>
<div class="line-clamp-2">{{ description }}</div>

<!-- Bad: No truncation, text overflows -->
<div>{{ longTitle }}</div>
```

**Expanded Content (CRITICAL):**

When content is expanded (accordions, details, expanded views), **MUST** add word wrapping:

```vue
<!-- Good: Expanded content with word wrapping -->
<div
  v-if="expanded"
  class="prose prose-sm max-w-none break-words"
  style="word-wrap: break-word; overflow-wrap: break-word"
>
  <MarkdownRenderer :content="content" />
</div>

<!-- Bad: No word wrapping causes horizontal scroll -->
<div v-if="expanded" class="prose prose-sm max-w-none">
  <MarkdownRenderer :content="content" />
</div>
```

**Mandatory Word Wrapping for Expanded Content:**

- **ALWAYS** add `break-words` class
- **ALWAYS** add inline styles: `style="word-wrap: break-word; overflow-wrap: break-word"`
- **REQUIRED** for markdown/prose content, long text, expanded views
- **VERIFY**: Test that no horizontal scrolling occurs when content is expanded

**Multi-line Text:**

- Use `line-clamp-2` or `line-clamp-3` for descriptions
- Provide full text on expansion (tooltip, modal, or expandable section)
- Code blocks: Always use horizontal scroll within container (`overflow-x-auto`)
- Regular text: **NEVER** allow horizontal scrolling - use word wrapping

### Layout Patterns

**Vertical Stacking:**

```vue
<!-- Good: Vertical layout for narrow panel -->
<div class="flex flex-col gap-3">
  <div>Item 1</div>
  <div>Item 2</div>
  <div>Item 3</div>
</div>

<!-- Avoid: Horizontal layouts that break in narrow space -->
<div class="flex flex-row gap-4">
  <div>Item 1</div>
  <div>Item 2</div>
  <div>Item 3</div>
</div>
```

**Responsive Flex Patterns:**

```vue
<!-- Good: Wraps or stacks appropriately -->
<div class="flex flex-wrap gap-2">
  <!-- Items wrap to next line -->
</div>

<!-- Good: Stacks on narrow, side-by-side on wider -->
<div class="flex flex-col gap-3 sm:flex-row">
  <!-- Note: Tailwind breakpoints may not apply in webview, prefer flex-col -->
</div>
```

### Component Sizing

**Buttons:**

- Primary buttons: Standard size (`h-9`) with `max-w-md` when full-width
- Icon buttons: `h-9 w-9` (36px) minimum for touch targets
- Small buttons: `h-8` (32px) minimum

**Inputs:**

- Standard height: `h-9` or `h-10`
- Full-width with max-width: `w-full max-w-md`
- Labels above inputs (not beside) for narrow layout

**Cards:**

- Padding: `p-3` or `p-4` (not `p-6`)
- Margin: `mb-2` or `mb-3` between cards
- Max-width: `max-w-lg` if cards might expand in fullscreen

### Scrolling Considerations

**⚠️ CRITICAL: Scrolling Behavior Rules**

**Vertical Scrolling:**

- Main content area: Use `overflow-y-auto` with `h-full` for proper scrolling
- **NEVER** use `overflow-auto` without height constraint - it can break scrolling
- Always ensure scrollable content is properly contained in a parent with defined height
- Use sticky headers for grouped content (`sticky top-0 z-10`)

**Horizontal Scrolling:**

- **STRICTLY FORBIDDEN** for main content areas
- **ONLY ALLOWED** for:
  - Code blocks (use `overflow-x-auto` on `<pre>` or code containers)
  - Wide tables (consider vertical layout first, scroll only if necessary)
- **ALWAYS** truncate long file paths instead of horizontal scroll

**Expanded Content Scrolling:**

When content expands (accordions, details, expanded views):

- Expanded content **MUST** be part of the main scrollable area
- **NEVER** nest scroll containers that prevent scrolling to expanded content
- **ALWAYS** test that you can scroll to the bottom of expanded content

```vue
<!-- Good: Proper scrolling with expanded content -->
<div class="flex-1 overflow-hidden">
  <div class="h-full overflow-y-auto">
    <div v-for="item in items">
      <div @click="expand(item)">
        {{ item.title }}
      </div>
      <div v-if="expanded === item.id" class="prose break-words" style="word-wrap: break-word; overflow-wrap: break-word">
        {{ item.content }}
      </div>
    </div>
  </div>
</div>

<!-- Bad: Scroll container prevents reaching expanded content -->
<div class="flex-1 overflow-auto">
  <div class="overflow-auto">
    <!-- Nested scroll prevents proper scrolling -->
  </div>
</div>
```

**Scrolling Checklist:**

- [ ] Main content uses `overflow-y-auto` with `h-full`
- [ ] No horizontal scrolling on main content
- [ ] Expanded content is scrollable within main container
- [ ] Can scroll to bottom of expanded content
- [ ] Sticky headers work correctly
- [ ] Code blocks have `overflow-x-auto` only

### Responsive Checklist

When creating or modifying components, verify:

- [ ] Component works at ~200px width (minimum viable size)
- [ ] Text is readable and doesn't overflow
- [ ] Long text is truncated with ellipsis
- [ ] Expanded content has word wrapping (`break-words` + inline styles)
- [ ] Buttons/inputs have max-width for fullscreen
- [ ] Spacing meets minimums: `py-4` for headers, `p-4` for cards, `mt-4` between sections
- [ ] Layout uses vertical stacking where appropriate
- [ ] Icons and buttons are appropriately sized (minimum 32px touch targets)
- [ ] Plain text buttons used for secondary actions (not Button component)
- [ ] Button component only used for primary actions
- [ ] Scrolling uses `overflow-y-auto` with `h-full` (not just `overflow-auto`)
- [ ] Expanded content is scrollable within main container
- [ ] No horizontal scroll on main content areas
- [ ] Full-width elements have reasonable max-width constraints

### Common Patterns

**Form Layout (Narrow Panel):**

```vue
<div class="flex flex-col gap-3">
  <label class="text-sm font-medium">Field Label</label>
  <input class="w-full max-w-md" />
  <p class="text-xs text-muted-foreground">Helper text</p>
</div>
```

**List Item (Narrow Panel):**

```vue
<div class="flex flex-col gap-2 p-3">
  <div class="truncate text-sm font-medium">Item Title</div>
  <div class="line-clamp-2 text-xs text-muted-foreground">
    Item description that might be long
  </div>
</div>
```

**Action Buttons (Narrow Panel):**

```vue
<!-- Primary actions use Button component -->
<div class="flex flex-col gap-3">
  <Button class="w-full max-w-md mx-auto">Primary Action</Button>
</div>

<!-- Secondary actions use plain text buttons -->
<div class="flex items-center gap-2">
  <button class="text-muted-foreground hover:text-muted-foreground/80 text-sm">
    Refresh
  </button>
  <button class="text-destructive hover:text-destructive/80 text-xs">
    Delete
  </button>
</div>
```

**Card Grid (Fullscreen Consideration):**

```vue
<!-- Single column in narrow, respects max-width in fullscreen -->
<div class="flex flex-col gap-3">
  <Card class="w-full max-w-lg mx-auto">Card 1</Card>
  <Card class="w-full max-w-lg mx-auto">Card 2</Card>
</div>
```

### Testing Responsiveness

Test components at multiple widths:

1. **Minimum**: ~200px (very narrow panel)
2. **Typical**: ~320-400px (normal side panel)
3. **Fullscreen**: ~1280px+ (fullscreen webview)

At each size:

- Text should be readable
- Interactive elements should be accessible
- No horizontal scrolling on main content
- Layout should feel intentional, not broken
- Full-width elements should have reasonable maximum width

## VS Code Webview API Features

### Available Webview Capabilities

1. **Message Passing**: Communication between extension and webview
   - Use MessageBusService (already implemented)
   - Never use direct `postMessage` or `onDidReceiveMessage`

2. **State Persistence**: `webview.getState()` and `webview.setState()`
   - Automatically restored when webview is hidden and shown
   - Use for preserving UI state across sessions

3. **Resource Loading**: `webview.asWebviewUri()`
   - For loading local images, styles, scripts
   - Already handled in `webviewContent.ts`

4. **Theme Changes**: VS Code automatically updates CSS variables
   - Theme changes are reflected immediately
   - No manual theme change listeners needed

### Webview UI Toolkit Status

**⚠️ IMPORTANT**: The `@vscode/webview-ui-toolkit` package is deprecated as of January 2025.

**Current Status:**

- Package is installed but deprecated
- Should NOT be used for new components
- Existing usage should be migrated to custom components

**Alternatives:**

- Use custom Vue components (already implemented)
- Style with Tailwind CSS and VS Code theme variables
- Build accessible components following WCAG guidelines

## Vue.js Best Practices

### Composition API

Always use Composition API with `<script setup>`:

```vue
<script setup lang="ts">
import { ref, computed, watch } from "vue";

const count = ref(0);
const doubled = computed(() => count.value * 2);

import { createLogger } from "@/utilities/logging";

const logger = createLogger("ComponentName");

watch(count, (newVal) => {
  logger.debug("Count changed", { count: newVal });
});
</script>
```

### Component Props

Use TypeScript interfaces for props:

```vue
<script setup lang="ts">
interface Props {
  title: string;
  optional?: number;
}

const props = defineProps<Props>();
</script>
```

### State Management

Use Pinia stores for shared state:

```typescript
// In a store (e.g., webview-ui/src/stores/example.ts)
import { defineStore } from "pinia";

export const useExampleStore = defineStore("example", () => {
  const data = ref(null);

  function updateData(newData: unknown) {
    data.value = newData;
  }

  return { data, updateData };
});
```

### Composables

Extract reusable logic into composables:

```typescript
// webview-ui/src/composables/useExample.ts
import { ref, computed } from "vue";

export function useExample() {
  const state = ref(false);
  const isActive = computed(() => state.value);

  function toggle() {
    state.value = !state.value;
  }

  return { state, isActive, toggle };
}
```

## Accessibility Requirements

### Color Contrast

VS Code theme colors automatically meet contrast requirements, but verify:

- Text on backgrounds has sufficient contrast
- Interactive elements are clearly distinguishable
- Focus indicators are visible

### Keyboard Navigation

- All interactive elements must be keyboard accessible
- Use semantic HTML elements (`<button>`, `<a>`, etc.)
- Implement proper tab order
- Support Enter/Space for buttons, Escape for dialogs

### ARIA Labels

Add ARIA labels when semantic HTML isn't sufficient:

```vue
<button aria-label="Close dialog" title="Close dialog">
  <svg aria-hidden="true">...</svg>
</button>
```

### Screen Reader Support

- Use semantic HTML
- Provide descriptive text alternatives
- Hide decorative icons with `aria-hidden="true"`

## Layout Patterns

### Page Structure

Standard page layout:

```vue
<template>
  <div class="flex h-full flex-col">
    <!-- Header/Breadcrumb (if needed) -->
    <div class="border-b px-4 py-3">
      <h1>Page Title</h1>
    </div>

    <!-- Main Content -->
    <div class="flex-1 overflow-auto px-4 py-3">
      <!-- Page content -->
    </div>

    <!-- Footer (if needed) -->
    <div class="border-t px-4 py-3">
      <!-- Footer content -->
    </div>
  </div>
</template>
```

### Container Patterns

**Full Width Container (with max-width for fullscreen):**

```vue
<div class="mx-auto w-full max-w-2xl">
  <!-- Content -->
</div>
```

**Centered Container (max width):**

```vue
<div class="container mx-auto px-4">
  <!-- Content -->
</div>
```

**Note**: For narrow panel webviews, prefer `max-w-md` or `max-w-lg` for most containers. Use `max-w-2xl` only for wide content areas in fullscreen mode.

**Flex Layouts:**

```vue
<!-- Horizontal -->
<div class="flex items-center gap-2">
  <!-- Items -->
</div>

<!-- Vertical -->
<div class="flex flex-col gap-4">
  <!-- Items -->
</div>
```

## Animation & Transitions

Keep animations minimal and purposeful:

**Hover Transitions:**

```vue
<button class="hover:bg-accent transition-colors">
  Hover me
</button>
```

**Loading States:**

- Use `LoadingState` component for async operations
- Provide skeleton screens for better UX

**Page Transitions:**

- Currently handled by Vue's conditional rendering
- Keep transitions fast and subtle

## Error & Loading States

### Loading State Component

Use `LoadingState` component with context:

```vue
<LoadingState context="wiki" class="flex-1" />
```

### Error Display

Errors are displayed through the centralized `GlobalErrorModal` component in App.vue. Components use the `useError` composable to report errors:

```vue
<script setup lang="ts">
import { useError } from "@/composables/useError";

const { showError } = useError();

function handleError() {
  showError({
    message: "Operation failed",
    code: "OPERATION_FAILED",
    suggestions: ["Check your connection"],
  });
}
</script>
```

The GlobalErrorModal automatically displays errors from the centralized error store and handles dismissal, actions, and navigation integration.

## Form Elements

### Input Fields

Use VS Code input styling:

```vue
<input
  type="text"
  class="border-input bg-muted text-foreground placeholder:text-muted-foreground focus-visible:ring-ring w-full rounded-md border px-3 py-2 focus-visible:outline-none focus-visible:ring-2"
  placeholder="Enter text..."
/>
```

### Select Dropdowns

```vue
<select
  class="border-input bg-muted text-foreground focus-visible:ring-ring w-full rounded-md border px-3 py-2 focus-visible:outline-none focus-visible:ring-2"
>
  <option>Option 1</option>
  <option>Option 2</option>
</select>
```

## Icons

### Icon Patterns

Use inline SVG icons with proper attributes:

```vue
<svg
  class="h-4 w-4"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  aria-hidden="true"
>
  <path d="..." />
</svg>
```

**Icon Sizes:**

- Small: `h-4 w-4` (16px)
- Default: `h-5 w-5` (20px)
- Large: `h-6 w-6` (24px)

**Icon Color:**

- Always use `currentColor` so icons inherit text color
- Icons adapt to theme automatically

## Scrollbar Styling

Custom scrollbars are already styled in `style.css` to match VS Code:

```css
/* Uses --scrollbar-bg variables */
/* Automatically adapts to theme */
```

No additional scrollbar styling needed in components.

## Code Blocks

For code blocks in markdown:

- Syntax highlighting: `highlight.js` (already configured)
- Theme: `github-dark.css` (auto-adjusts for light themes)
- Styling: Handled in `MarkdownRenderer.vue`

## Component Naming Conventions

- **Files**: PascalCase (e.g., `Button.vue`, `CardHeader.vue`)
- **Components**: PascalCase (e.g., `<Button>`, `<CardHeader>`)
- **Props**: camelCase (e.g., `isLoading`, `variant`)
- **Events**: kebab-case (e.g., `@update:model-value`, `@click`)
- **Stores**: camelCase with "use" prefix (e.g., `useWikiStore`)
- **Composables**: camelCase with "use" prefix (e.g., `useNavigation`)

## File Organization

```
webview-ui/src/
├── components/
│   ├── ui/           # Base/reusable UI components
│   ├── features/     # Feature-specific components
│   ├── pages/        # Page-level components
│   └── layout/       # Layout components
├── stores/           # Pinia stores
├── composables/      # Vue composables
├── lib/              # Utility functions
└── style.css         # Global styles and theme variables
```

## Testing Visual Consistency

When creating or modifying components:

1. ✅ Check in both light and dark VS Code themes
2. ✅ Verify colors use theme variables (not hardcoded)
3. ✅ Test keyboard navigation
4. ✅ Verify focus indicators are visible
5. ✅ Check responsive behavior (webview resizing)
6. ✅ Ensure proper contrast ratios
7. ✅ Test with screen reader (if available)

## Common Patterns Reference

### Navigation Buttons

```vue
<button
  class="text-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring inline-flex h-9 w-9 items-center justify-center rounded-md bg-transparent transition-all duration-200 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2"
  title="Button Title"
  @click="handleClick"
>
  <svg class="h-4 w-4" aria-hidden="true">...</svg>
</button>
```

### Back Button

```vue
<a
  class="text-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md bg-transparent transition-all duration-200 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2"
  title="Back"
  @click="handleBack"
>
  <svg class="h-5 w-5" viewBox="0 0 1024 1024" aria-hidden="true">...</svg>
</a>
```

### Card with Content

```vue
<Card class="p-4">
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>
    <p>Content goes here</p>
  </CardContent>
</Card>
```

## Migration from Webview UI Toolkit

If encountering deprecated toolkit components:

1. Identify the component functionality
2. Check if equivalent custom component exists
3. If not, create new component following patterns above
4. Replace toolkit usage with custom component
5. Remove toolkit dependency if no longer needed

## Resources

- [VS Code Webview API](https://code.visualstudio.com/api/extension-guides/webview)
- [VS Code Theme Color Reference](https://code.visualstudio.com/api/references/theme-color)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Vue.js 3 Documentation](https://vuejs.org/)
- [WCAG Accessibility Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

## Key Takeaways for AI Agents

1. **ALWAYS use VS Code theme variables** - Never hardcode colors
2. **Design for narrow vertical panel** - Webview is 1/4-1/5 screen width, typically 320-400px
3. **Use plain text buttons for secondary actions** - Button component ONLY for primary actions
4. **Minimum spacing requirements** - `py-4` for headers, `p-4` for cards, `mt-4` between sections (NOT less)
5. **Word wrapping for expanded content** - ALWAYS add `break-words` + inline styles for expanded views
6. **Proper scrolling** - Use `overflow-y-auto` with `h-full`, expanded content must be scrollable
7. **Add max-width to full-width elements** - Buttons, inputs, and containers need `max-w-md` or similar for fullscreen
8. **Follow existing component patterns** - Check `webview-ui/src/components/ui/` first
9. **Use Tailwind CSS classes** - Leverage existing theme integration
10. **Maintain accessibility** - Include focus states, ARIA labels, keyboard navigation
11. **Truncate long text** - Use `truncate` or `line-clamp` to prevent overflow
12. **Prefer vertical layouts** - Stack elements vertically for narrow panels
13. **Keep components small** - Follow single responsibility principle
14. **Test in both themes** - Verify light and dark mode appearance
15. **Test at multiple widths** - Verify at ~200px (min), ~350px (typical), and fullscreen
16. **No horizontal scrolling** - Except for code blocks, use word wrapping instead
17. **Avoid webview-ui-toolkit** - Use custom components instead
18. **Use Composition API** - Always use `<script setup>` syntax
19. **Leverage existing stores/composables** - Check before creating new ones
20. **Maintain consistency** - Follow established patterns and conventions
