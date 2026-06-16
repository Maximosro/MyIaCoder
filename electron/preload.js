import { contextBridge, ipcRenderer } from 'electron';
contextBridge.exposeInMainWorld('electronAPI', {
    listProjects: () => ipcRenderer.invoke('list-projects'),
    readPlansTree: () => ipcRenderer.invoke('read-plans-tree'),
    readProjectTree: (projectPath) => ipcRenderer.invoke('read-project-tree', projectPath),
    refreshBranch: (projectPath) => ipcRenderer.invoke('refresh-branch', projectPath),
    readFileContent: (filePath) => ipcRenderer.invoke('read-file-content', filePath),
    writeFileContent: (filePath, content) => ipcRenderer.invoke('write-file-content', filePath, content),
    ptySpawn: (tabId, projectPath) => ipcRenderer.invoke('pty-spawn', tabId, projectPath),
    ptyRead: (tabId) => ipcRenderer.invoke('pty-read', tabId),
    ptyIsAlive: (tabId) => ipcRenderer.invoke('pty-is-alive', tabId),
    ptyInput: (tabId, data) => ipcRenderer.invoke('pty-input', tabId, data),
    ptyResize: (tabId, cols, rows) => ipcRenderer.invoke('pty-resize', tabId, cols, rows),
    ptyKill: (tabId) => ipcRenderer.invoke('pty-kill', tabId),
    launchVscode: (projectPath) => ipcRenderer.invoke('launch-vscode', projectPath),
    getSettings: () => ipcRenderer.invoke('get-settings'),
    saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
    pickWorkspace: () => ipcRenderer.invoke('pick-workspace'),
    pickFolder: (title) => ipcRenderer.invoke('pick-folder', title),
    // Window controls (frameless custom title bar)
    windowMinimize: () => ipcRenderer.invoke('window-minimize'),
    windowMaximize: () => ipcRenderer.invoke('window-maximize'),
    windowIsMaximized: () => ipcRenderer.invoke('window-is-maximized'),
    windowClose: () => ipcRenderer.invoke('window-close'),
    onMaximizedChanged: (callback) => {
        const handler = (_event, isMaximized) => callback(isMaximized);
        ipcRenderer.on('window-maximized-changed', handler);
        return () => ipcRenderer.removeListener('window-maximized-changed', handler);
    },
});
