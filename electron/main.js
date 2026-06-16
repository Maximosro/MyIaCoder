import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'node:path';
import { exec } from 'node:child_process';
import { scanWorkspace, readDirectoryTree, readClaudeGithubTree, readFileContent, writeFileContent } from './services/filesystem';
import { getGitBranch } from './services/git';
import { loadSettings, saveSettings } from './services/settings';
import { PTYManager } from './pty-manager';
let mainWindow = null;
const ptyManager = new PTYManager();
function createWindow() {
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
    }
    else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
// ── IPC Handlers ──────────────────────────────────────────────
function registerIpcHandlers() {
    ipcMain.handle('list-projects', async () => {
        const settings = loadSettings();
        return scanWorkspace(settings.workspacePath);
    });
    ipcMain.handle('refresh-branch', async (_event, projectPath) => {
        return getGitBranch(projectPath);
    });
    ipcMain.handle('get-settings', async () => loadSettings());
    ipcMain.handle('save-settings', async (_event, settings) => {
        saveSettings(settings);
    });
    ipcMain.handle('pick-workspace', async () => {
        if (!mainWindow)
            return null;
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openDirectory'],
            title: 'Select Workspace Folder',
        });
        return result.canceled ? null : result.filePaths[0];
    });
    ipcMain.handle('pick-folder', async (_event, title) => {
        if (!mainWindow)
            return null;
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
    ipcMain.handle('read-project-tree', async (_event, projectPath) => {
        return readClaudeGithubTree(projectPath);
    });
    ipcMain.handle('read-file-content', async (_event, filePath) => {
        const settings = loadSettings();
        const resolved = path.resolve(filePath);
        const workspaceRoot = path.resolve(settings.workspacePath);
        const plansRoot = path.resolve(settings.plansPath);
        const inWorkspace = workspaceRoot && resolved.startsWith(workspaceRoot);
        const inPlans = plansRoot && resolved.startsWith(plansRoot);
        if (!inWorkspace && !inPlans) {
            throw new Error('PATH_TRAVERSAL');
        }
        return readFileContent(filePath);
    });
    ipcMain.handle('write-file-content', async (_event, filePath, content) => {
        const settings = loadSettings();
        const resolved = path.resolve(filePath);
        const workspaceRoot = path.resolve(settings.workspacePath);
        const plansRoot = path.resolve(settings.plansPath);
        const inWorkspace = workspaceRoot && resolved.startsWith(workspaceRoot);
        const inPlans = plansRoot && resolved.startsWith(plansRoot);
        if (!inWorkspace && !inPlans) {
            throw new Error('PATH_TRAVERSAL');
        }
        writeFileContent(filePath, content);
    });
    // PTY handlers — polling-based (no webContents.send, sandbox-compatible)
    ipcMain.handle('pty-spawn', async (_event, tabId, projectPath) => {
        ptyManager.spawn(tabId, projectPath);
    });
    ipcMain.handle('pty-read', async (_event, tabId) => {
        return ptyManager.read(tabId);
    });
    ipcMain.handle('pty-is-alive', async (_event, tabId) => {
        return ptyManager.isAlive(tabId);
    });
    ipcMain.handle('pty-input', async (_event, tabId, data) => {
        ptyManager.input(tabId, data);
    });
    ipcMain.handle('pty-resize', async (_event, tabId, cols, rows) => {
        ptyManager.resize(tabId, cols, rows);
    });
    ipcMain.handle('pty-kill', async (_event, tabId) => {
        ptyManager.kill(tabId);
    });

    ipcMain.handle('launch-vscode', async (_event, projectPath) => {
        const cmd = process.platform === 'win32'
            ? `code "${projectPath}"`
            : `code '${projectPath}'`;
        exec(cmd, (error) => {
            if (error) {
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
