# AI Code Manager

Desktop application (Windows) to manage multiple projects with an integrated
Claude Code terminal — powered by Electron, React, xterm.js, and node-pty.

## Stack

- **Runtime**: Electron 35
- **UI**: React 19 + TypeScript 5.7 + TailwindCSS 4
- **Build**: Vite 6 + vite-plugin-electron
- **Terminal**: xterm.js 5.x + node-pty 1.x
- **Package**: electron-builder 25 (NSIS installer)

## Prerequisites

- Node.js ≥ 18
- Visual Studio Build Tools (for `node-pty` native compilation)
- Claude Code CLI installed globally:
  ```bash
  npm install -g @anthropic-ai/claude-code
  ```
- Git (to read branch names)

## Development

> ⚠️ **Primera vez?** Seguí la [guía completa de setup →](SETUP.md)  
> Cubre requisitos, Visual Studio Build Tools, y el workaround para el binario de Electron.

```bash
npm install
npm run dev        # Starts Vite + Electron in dev mode
```

## Build

```bash
npm run build           # TypeScript + Vite production build
npm run build:electron  # Full build + .exe installer
```

The `.exe` will be in `release/`.

## Lint & Test

```bash
npm run lint   # TypeScript type check
npm test       # Vitest test suite
```

## Project Structure

```
ai-code-manager/
├── electron/              # Electron main process
│   ├── main.ts            # App entry, window, IPC handlers
│   ├── preload.ts         # contextBridge API exposure
│   ├── pty-manager.ts     # node-pty session management
│   ├── ipc/               # IPC handlers (docker, git, filesystem, pty, settings, tasks)
│   └── services/          # Core services (docker, git, filesystem, tasks, settings, wsl-session)
├── src/                   # React renderer
│   ├── main.tsx           # React entry point
│   ├── App.tsx            # Root layout — project selection, tab sync, keyboard shortcuts
│   ├── index.css          # TailwindCSS 4 + xterm styles + copper-ambient theme
│   ├── components/
│   │   ├── Sidebar.tsx    # Project list, file tree, git changes, tasks, plans/skills/prompts
│   │   ├── TerminalPanel.tsx  # Tab bar (DnD reorder) + content area (terminal / editor / diff)
│   │   ├── TerminalTab.tsx    # xterm.js + addons (fit, webgl, search, ligatures, serialize)
│   │   ├── FileEditor.tsx     # Monaco editor for text/json/md/yaml/toml/xml/properties
│   │   ├── DiffViewer.tsx     # Side-by-side git diff viewer
│   │   ├── ProjectItem.tsx    # Single project row with branch badge
│   │   ├── ProjectInfo.tsx    # Empty-state project overview
│   │   ├── TitleBar.tsx       # Custom Windows title bar
│   │   ├── ProjectSearch.tsx  # Ctrl+Shift+F fuzzy project finder
│   │   ├── GitChangesTree.tsx # Git status tree with diff/open actions
│   │   ├── TasksTree.tsx      # Live CLI session tasks (Claude/Copilot/Reasonix)
│   │   ├── PlansPanelTabs.tsx # Plans / Skills / Prompts / Templates file browser
│   │   ├── ConfigModal.tsx    # Settings modal (workspace, clients, WSL, scrollback)
│   │   ├── CommitModal.tsx    # Git commit modal with diff preview
│   │   ├── NewBranchModal.tsx # Git branch creation from issue slug
│   │   ├── SwitchBranchModal.tsx # Git branch switcher
│   │   ├── RunCommandModal.tsx   # Play/Stop command configurator
│   │   ├── GuidedPromptModal.tsx # AI prompt wizard
│   │   ├── DockerComposeModal.tsx
│   │   ├── ContainersModal.tsx
│   │   ├── CloseTerminalDialog.tsx
│   │   ├── UnsavedDialog.tsx
│   │   └── AboutModal.tsx
│   ├── hooks/
│   │   ├── useProjects.ts     # Workspace project scanner
│   │   ├── useTabs.ts         # Tab lifecycle (terminal, file, diff) + DnD reorder
│   │   ├── useProjectTree.ts  # File tree for selected project
│   │   ├── useGitChanges.ts   # Git status for selected project
│   │   ├── useTasks.ts        # Live task discovery from CLI agents
│   │   ├── usePlansTree.ts    # Plans directory tree
│   │   ├── useSkillsTree.ts   # Skills directory tree
│   │   ├── usePromptsTree.ts  # Prompts directory tree
│   │   └── useTemplatesTree.ts # Templates directory tree
│   ├── types/
│   │   ├── project.ts         # Project, TreeNode, GitChange, Settings
│   │   ├── tab.ts             # Tab (terminal | file | diff) + type guards
│   │   └── task.ts            # Task source types
│   └── utils/
│       ├── tabUtils.ts        # File type detection, command/type colors
│       ├── branchPrefixes.ts  # Branch name conventions
│       ├── branchUtils.ts     # Branch parsing utilities
│       └── gitStatus.ts       # Git status helpers
├── electron-builder.yml
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## Key behaviors

- **Tab → project sync**: selecting any tab (terminal, file, diff) automatically switches the sidebar to that tab's project. Keyboard shortcuts (`Ctrl+Tab`, `Ctrl+1..9`) also sync. Plans/skills/prompts tabs are excluded (they don't belong to a workspace project).
