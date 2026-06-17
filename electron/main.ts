import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'node:path';
import { exec } from 'node:child_process';
import { scanWorkspace, readDirectoryTree, readClaudeGithubTree, readFileContent, writeFileContent, deleteEntry } from './services/filesystem';
import { getGitBranch, getGitChanges, getGitDiff, getGitFileVersions } from './services/git';
import { loadSettings, saveSettings } from './services/settings';
import { loadTodos, saveTodos } from './services/todos';
import type { TodoItem } from './services/todos';
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
    frame: false,
    backgroundColor: '#050505',
    autoHideMenuBar: true,
    titleBarOverlay: {
      color: '#050505',
      symbolColor: '#f0ece8',
      height: 36,
    },
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

  ipcMain.handle('git-changes', async (_event, projectPath: string) => {
    return getGitChanges(projectPath);
  });

  ipcMain.handle('git-diff', async (_event, projectPath: string, filePath: string) => {
    return getGitDiff(projectPath, filePath);
  });

  ipcMain.handle('git-file-versions', async (_event, projectPath: string, filePath: string) => {
    return getGitFileVersions(projectPath, filePath);
  });

  ipcMain.handle('get-settings', async () => loadSettings());

  ipcMain.handle('save-settings', async (_event, settings: Settings) => {
    saveSettings(settings);
  });

  ipcMain.handle('load-todos', async () => {
    return loadTodos();
  });

  ipcMain.handle('save-todos', async (_event, items: TodoItem[]) => {
    saveTodos(items);
  });

  ipcMain.handle('pick-workspace', async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Select Workspace Folder',
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('pick-folder', async (_event, title: string) => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title,
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('read-plans-tree', async () => {
    const settings = loadSettings();
    return readDirectoryTree(settings.plansPath);
  });

  ipcMain.handle('read-skills-tree', async () => {
    const settings = loadSettings();
    return readDirectoryTree(settings.skillsPath);
  });

  ipcMain.handle('read-project-tree', async (_event, projectPath: string) => {
    return readClaudeGithubTree(projectPath);
  });

  ipcMain.handle('read-file-content', async (_event, filePath: string) => {
    const settings = loadSettings();
    const resolved = path.resolve(filePath);
    const workspaceRoot = path.resolve(settings.workspacePath);
    const plansRoot = path.resolve(settings.plansPath);
    const skillsRoot = path.resolve(settings.skillsPath);
    const inWorkspace = workspaceRoot && resolved.startsWith(workspaceRoot);
    const inPlans = plansRoot && resolved.startsWith(plansRoot);
    const inSkills = skillsRoot && resolved.startsWith(skillsRoot);
    if (!inWorkspace && !inPlans && !inSkills) {
      throw new Error('PATH_TRAVERSAL');
    }
    return readFileContent(filePath);
  });

  ipcMain.handle('write-file-content', async (_event, filePath: string, content: string) => {
    const settings = loadSettings();
    const resolved = path.resolve(filePath);
    const workspaceRoot = path.resolve(settings.workspacePath);
    const plansRoot = path.resolve(settings.plansPath);
    const skillsRoot = path.resolve(settings.skillsPath);
    const inWorkspace = workspaceRoot && resolved.startsWith(workspaceRoot);
    const inPlans = plansRoot && resolved.startsWith(plansRoot);
    const inSkills = skillsRoot && resolved.startsWith(skillsRoot);
    if (!inWorkspace && !inPlans && !inSkills) {
      throw new Error('PATH_TRAVERSAL');
    }
    writeFileContent(filePath, content);
  });

  ipcMain.handle('delete-file', async (_event, filePath: string) => {
    const settings = loadSettings();
    const resolved = path.resolve(filePath);
    const workspaceRoot = path.resolve(settings.workspacePath);
    const plansRoot = path.resolve(settings.plansPath);
    const skillsRoot = path.resolve(settings.skillsPath);
    const inWorkspace = workspaceRoot && resolved.startsWith(workspaceRoot);
    const inPlans = plansRoot && resolved.startsWith(plansRoot);
    const inSkills = skillsRoot && resolved.startsWith(skillsRoot);
    if (!inWorkspace && !inPlans && !inSkills) {
      throw new Error('PATH_TRAVERSAL');
    }
    deleteEntry(filePath);
  });

  // PTY handlers — polling-based (no webContents.send, sandbox-compatible)
  ipcMain.handle('pty-spawn', async (_event, tabId: string, projectPath: string, command?: string) => {
    ptyManager.spawn(tabId, projectPath, command);
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

  ipcMain.handle('launch-vscode', async (_event, projectPath: string) => {
    const cmd = process.platform === 'win32'
      ? `code "${projectPath}"`
      : `code '${projectPath}'`;
    exec(cmd, (error) => {
      if (error) {
        // Fallback: try opening the folder in explorer / finder
        shell.openPath(projectPath);
      }
    });
  });

  // ── Window controls (frameless custom title bar) ─────────
  ipcMain.handle('window-minimize', () => {
    mainWindow?.minimize();
  });

  ipcMain.handle('window-maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });

  ipcMain.handle('window-is-maximized', () => {
    return mainWindow?.isMaximized() ?? false;
  });

  ipcMain.handle('window-close', () => {
    mainWindow?.close();
  });

  // Notify renderer when maximize state changes
  mainWindow?.on('maximize', () => {
    mainWindow?.webContents.send('window-maximized-changed', true);
  });
  mainWindow?.on('unmaximize', () => {
    mainWindow?.webContents.send('window-maximized-changed', false);
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
