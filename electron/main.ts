import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'node:path';
import { scanWorkspace } from './services/filesystem';
import { getGitBranch } from './services/git';
import { loadSettings, saveSettings } from './services/settings';
import type { Settings } from './services/settings';
import { PTYManager } from './pty-manager';

let mainWindow: BrowserWindow | null = null;
const ptyManager = new PTYManager();

function createWindow(): void {
  const preloadPath = path.join(__dirname, 'preload.js');

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0c0c0c',
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ── IPC Handlers ──────────────────────────────────────────────

function registerIpcHandlers(): void {
  ipcMain.handle('list-projects', async () => {
    const settings = loadSettings();
    return scanWorkspace(settings.workspacePath);
  });

  ipcMain.handle('refresh-branch', async (_event, projectPath: string) => {
    return getGitBranch(projectPath);
  });

  ipcMain.handle('get-settings', async () => loadSettings());

  ipcMain.handle('save-settings', async (_event, settings: Settings) => {
    saveSettings(settings);
  });

  ipcMain.handle('pick-workspace', async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Select Workspace Folder',
    });
    return result.canceled ? null : result.filePaths[0];
  });

  // PTY handlers — polling-based (no webContents.send, sandbox-compatible)
  ipcMain.handle('pty-spawn', async (_event, tabId: string, projectPath: string) => {
    ptyManager.spawn(tabId, projectPath);
  });

  ipcMain.handle('pty-read', async (_event, tabId: string) => {
    return ptyManager.read(tabId);
  });

  ipcMain.handle('pty-is-alive', async (_event, tabId: string) => {
    return ptyManager.isAlive(tabId);
  });

  ipcMain.handle('pty-input', async (_event, tabId: string, data: string) => {
    ptyManager.input(tabId, data);
  });

  ipcMain.handle('pty-resize', async (_event, tabId: string, cols: number, rows: number) => {
    ptyManager.resize(tabId, cols, rows);
  });

  ipcMain.handle('pty-kill', async (_event, tabId: string) => {
    ptyManager.kill(tabId);
  });
}

// ── App Lifecycle ─────────────────────────────────────────────

app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('before-quit', () => {
  ptyManager.killAll();
});
