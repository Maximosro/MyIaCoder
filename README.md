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
│   └── services/
│       ├── filesystem.ts  # Workspace scanner
│       ├── git.ts         # Git branch reader
│       └── settings.ts    # Config persistence
├── src/                   # React renderer
│   ├── main.tsx           # React entry point
│   ├── App.tsx            # Root layout
│   ├── index.css          # TailwindCSS + xterm styles
│   ├── components/
│   │   ├── Sidebar.tsx    # Project list panel
│   │   ├── ProjectItem.tsx
│   │   ├── ProjectInfo.tsx
│   │   ├── TerminalPanel.tsx
│   │   ├── TerminalTab.tsx
│   │   └── StatusBar.tsx
│   ├── hooks/
│   │   ├── useProjects.ts
│   │   └── useTerminal.ts
│   └── types/
│       ├── project.ts
│       └── terminal.ts
├── electron-builder.yml   # .exe packaging config
├── vite.config.ts
└── package.json
```
