import { contextBridge, ipcRenderer } from 'electron';

export interface Project {
  name: string;
  path: string;
  branch: string;
}

export interface Settings {
  workspacePath: string;
  theme: 'system' | 'light' | 'dark';
}

export interface ElectronAPI {
  listProjects: () => Promise<Project[]>;
  refreshBranch: (projectPath: string) => Promise<string>;
  ptySpawn: (tabId: string, projectPath: string) => Promise<void>;
  ptyRead: (tabId: string) => Promise<string | null>;
  ptyIsAlive: (tabId: string) => Promise<boolean>;
  ptyInput: (tabId: string, data: string) => Promise<void>;
  ptyResize: (tabId: string, cols: number, rows: number) => Promise<void>;
  ptyKill: (tabId: string) => Promise<void>;
  getSettings: () => Promise<Settings>;
  saveSettings: (settings: Settings) => Promise<void>;
  pickWorkspace: () => Promise<string | null>;
}

contextBridge.exposeInMainWorld('electronAPI', {
  listProjects: () => ipcRenderer.invoke('list-projects'),
  refreshBranch: (projectPath: string) => ipcRenderer.invoke('refresh-branch', projectPath),
  ptySpawn: (tabId: string, projectPath: string) => ipcRenderer.invoke('pty-spawn', tabId, projectPath),
  ptyRead: (tabId: string) => ipcRenderer.invoke('pty-read', tabId),
  ptyIsAlive: (tabId: string) => ipcRenderer.invoke('pty-is-alive', tabId),
  ptyInput: (tabId: string, data: string) => ipcRenderer.invoke('pty-input', tabId, data),
  ptyResize: (tabId: string, cols: number, rows: number) => ipcRenderer.invoke('pty-resize', tabId, cols, rows),
  ptyKill: (tabId: string) => ipcRenderer.invoke('pty-kill', tabId),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings: Settings) => ipcRenderer.invoke('save-settings', settings),
  pickWorkspace: () => ipcRenderer.invoke('pick-workspace'),
} satisfies ElectronAPI);
