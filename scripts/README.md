# Scripts

## fix-imports.ts

Automatically converts all relative imports (`../../`, `../`, `./`) to path aliases (`@/`, `@/application/`, etc.) based on your `tsconfig.json` configuration.

### Usage

```bash
pnpm run fix-imports
```

### What it does

1. Scans all TypeScript files in `src/` and `webview-ui/src/`
2. Finds all relative imports (e.g., `import { X } from "../../something"`)
3. Converts them to path aliases (e.g., `import { X } from "@/something"`)
4. Updates the files in place
5. Provides a summary of changes

### Path Alias Mappings

The script uses the path mappings from `tsconfig.json`:

- `@/constants` → `src/constants`
- `@/application/*` → `src/application/*`
- `@/infrastructure/*` → `src/infrastructure/*`
- `@/domain/*` → `src/domain/*`
- `@/events/*` → `src/events/*`
- `@/llm/*` → `src/llm/*`
- `@/utilities/*` → `src/utilities/*`
- `@/panels/*` → `src/panels/*`
- `@/providers/*` → `src/providers/*`
- `@/views/*` → `src/views/*`
- `@/presentation/*` → `src/presentation/*`
- `@/factories/*` → `src/factories/*`
- `@/container/*` → `src/container/*`
- `@/errors/*` → `src/errors/*`
- `@/*` → `src/*` (fallback for anything else)

### Notes

- The script preserves file extensions in imports (removes `.ts`/`.tsx` if present)
- It handles both regular imports and `import type` statements
- Files are updated in place - make sure you have a backup or use version control
- The script will skip files outside the `src/` directory structure
