import { contextBridge, ipcRenderer } from 'electron';
import type { TreeNode } from './services/filesystem';

export interface Project {
  name: string;
  path: string;
  branch: string;
}

export interface Settings {
  workspacePath: string;
  plansPath: string;
  theme: 'system' | 'light' | 'dark';
}

export interface ElectronAPI {
  listProjects: () => Promise<Project[]>;
  readPlansTree: () => Promise<TreeNode[]>;
  readProjectTree: (projectPath: string) => Promise<TreeNode[]>;
  refreshBranch: (projectPath: string) => Promise<string>;
  readFileContent: (filePath: string) => Promise<string>;
  writeFileContent: (filePath: string, content: string) => Promise<void>;
  ptySpawn: (tabId: string, projectPath: string) => Promise<void>;
  ptyRead: (tabId: string) => Promise<string | null>;
  ptyIsAlive: (tabId: string) => Promise<boolean>;
  ptyInput: (tabId: string, data: string) => Promise<void>;
  ptyResize: (tabId: string, cols: number, rows: number) => Promise<void>;
  ptyKill: (tabId: string) => Promise<void>;
  launchVscode: (projectPath: string) => Promise<void>;
  getSettings: () => Promise<Settings>;
  saveSettings: (settings: Settings) => Promise<void>;
  pickWorkspace: () => Promise<string | null>;
  pickFolder: (title: string) => Promise<string | null>;
  // Window controls (frameless custom title bar)
  windowMinimize: () => Promise<void>;
  windowMaximize: () => Promise<void>;
  windowIsMaximized: () => Promise<boolean>;
  windowClose: () => Promise<void>;
  onMaximizedChanged: (callback: (isMaximized: boolean) => void) => () => void;
}

contextBridge.exposeInMainWorld('electronAPI', {
  listProjects: () => ipcRenderer.invoke('list-projects'),
  readPlansTree: () => ipcRenderer.invoke('read-plans-tree'),
  readProjectTree: (projectPath: string) => ipcRenderer.invoke('read-project-tree', projectPath),
  refreshBranch: (projectPath: string) => ipcRenderer.invoke('refresh-branch', projectPath),
  readFileContent: (filePath: string) => ipcRenderer.invoke('read-file-content', filePath),
  writeFileContent: (filePath: string, content: string) => ipcRenderer.invoke('write-file-content', filePath, content),
  ptySpawn: (tabId: string, projectPath: string) => ipcRenderer.invoke('pty-spawn', tabId, projectPath),
  ptyRead: (tabId: string) => ipcRenderer.invoke('pty-read', tabId),
  ptyIsAlive: (tabId: string) => ipcRenderer.invoke('pty-is-alive', tabId),
  ptyInput: (tabId: string, data: string) => ipcRenderer.invoke('pty-input', tabId, data),
  ptyResize: (tabId: string, cols: number, rows: number) => ipcRenderer.invoke('pty-resize', tabId, cols, rows),
  ptyKill: (tabId: string) => ipcRenderer.invoke('pty-kill', tabId),
  launchVscode: (projectPath: string) => ipcRenderer.invoke('launch-vscode', projectPath),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings: Settings) => ipcRenderer.invoke('save-settings', settings),
  pickWorkspace: () => ipcRenderer.invoke('pick-workspace'),
  pickFolder: (title: string) => ipcRenderer.invoke('pick-folder', title),
  // Window controls (frameless custom title bar)
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowMaximize: () => ipcRenderer.invoke('window-maximize'),
  windowIsMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  windowClose: () => ipcRenderer.invoke('window-close'),
  onMaximizedChanged: (callback: (isMaximized: boolean) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, isMaximized: boolean) => callback(isMaximized);
    ipcRenderer.on('window-maximized-changed', handler);
    return () => ipcRenderer.removeListener('window-maximized-changed', handler);
  },
} satisfies ElectronAPI);
