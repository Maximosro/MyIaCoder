# Copilot Instructions — AI Code Manager

## Commands

```bash
npm run dev            # Vite + Electron dev mode (hot reload)
npm run build          # TypeScript + Vite production build
npm run build:electron # Full .exe installer (requires rebuild:sqlite first)
npm run lint           # tsc --noEmit (type check only, no linter rules)
npm test               # vitest run (all tests)
npx vitest run src/components/__tests__/TerminalTab.test.tsx  # single test
```

## Architecture

Electron app with strict main/renderer split:

- **Main process** (`electron/`): node-pty terminal management, IPC handlers, services (git, filesystem, docker, tasks, settings). Each domain has a service in `electron/services/` and its IPC registration in `electron/ipc/`.
- **Renderer** (`src/`): React 19 SPA. State lives in hooks (`src/hooks/`), UI in `src/components/`. No routing — single-page layout with sidebar + tabbed terminal/editor panel.
- **Preload** (`electron/preload.ts`): contextBridge exposes `window.electronAPI`. All main↔renderer communication goes through typed IPC — never import node modules from renderer.

The app manages multiple AI coding clients (Claude Code, Copilot CLI, Reasonix, OpenCode, CodeWhale) as terminal sessions via node-pty. Each project can have multiple terminal tabs.

## Conventions

- **Path alias**: `@/` maps to `src/` (configured in vite.config.ts + tsconfig).
- **Styling**: TailwindCSS 4 utility classes. No CSS modules, no styled-components.
- **Tests**: Vitest + @testing-library/react. Tests live in `__tests__/` directories colocated with their source. No test framework config beyond vitest defaults.
- **Native modules**: `node-pty` and `better-sqlite3` are externalized in Vite config and rebuilt for Electron's Node version.
- **IPC pattern**: Service function in `electron/services/X.ts` → registered as IPC handler in `electron/ipc/X.ipc.ts` → exposed in `electron/preload.ts` → consumed in renderer via `window.electronAPI.method()`.
- **Types**: Shared types live in `src/types/`. The `Project` type is duplicated in preload (for main process) and `src/types/project.ts` (for renderer) — keep them in sync.
- **WSL support**: Git and terminal operations can optionally run inside WSL2 (configured per-user in settings). Service code handles both native Windows and WSL paths.
