import { contextBridge, ipcRenderer } from 'electron';
import type { TreeNode } from './services/filesystem';

export interface Project {
  name: string;
  path: string;
  branch: string;
}

export interface ClientsConfig {
  claude: boolean;
  copilot: boolean;
  codewhale: boolean;
  reasonix: boolean;
  opencode: boolean;
}

export interface Settings {
  workspacePath: string;
  plansPath: string;
  skillsPath: string;
  promptsPath: string;
  theme: 'system' | 'light' | 'dark';
  clients: ClientsConfig;
  terminalScrollback: number;
}

export interface ElectronAPI {
  listProjects: () => Promise<Project[]>;
  readPlansTree: () => Promise<TreeNode[]>;
  readSkillsTree: () => Promise<TreeNode[]>;
  readPromptsTree: () => Promise<TreeNode[]>;
  readProjectTree: (projectPath: string) => Promise<TreeNode[]>;
  refreshBranch: (projectPath: string) => Promise<string>;
  getGitChanges: (projectPath: string) => Promise<import('./services/git').GitChangesResult>;
  getGitDiff: (projectPath: string, filePath: string) => Promise<string>;
  getGitFileVersions: (projectPath: string, filePath: string) => Promise<import('./services/git').GitFileVersions>;
  discardGitChanges: (projectPath: string, filePath: string) => Promise<import('./services/git').DiscardResult>;
  getProjectTasks: (projectPath: string, source: import('./services/tasks').TaskSource) => Promise<import('./services/tasks').ProjectTasksResult>;
  readFileContent: (filePath: string) => Promise<string>;
  writeFileContent: (filePath: string, content: string) => Promise<void>;
  createFile: (filePath: string, content: string) => Promise<void>;
  deleteFile: (filePath: string) => Promise<void>;
  ptySpawn: (tabId: string, projectPath: string, command?: string, title?: string) => Promise<void>;
  ptyRead: (tabId: string) => Promise<string | null>;
  ptyIsAlive: (tabId: string) => Promise<boolean>;
  ptyInput: (tabId: string, data: string) => Promise<void>;
  ptyResize: (tabId: string, cols: number, rows: number) => Promise<void>;
  ptyKill: (tabId: string) => Promise<void>;
  launchVscode: (projectPath: string) => Promise<void>;
  launchTerminal: (kind: 'wt' | 'powershell') => Promise<void>;
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
  onProjectBranchLoaded: (callback: (data: { path: string; branch: string }) => void) => () => void;
  onTasksChanged: (callback: () => void) => () => void;
  getAppVersion: () => Promise<string>;
  onPtyData: (callback: (tabId: string, data: string) => void) => () => void;
  onPtyExit: (callback: (tabId: string, exitCode: number) => void) => () => void;
}

contextBridge.exposeInMainWorld('electronAPI', {
  listProjects: () => ipcRenderer.invoke('list-projects'),
  readPlansTree: () => ipcRenderer.invoke('read-plans-tree'),
  readSkillsTree: () => ipcRenderer.invoke('read-skills-tree'),
  readPromptsTree: () => ipcRenderer.invoke('read-prompts-tree'),
  readProjectTree: (projectPath: string) => ipcRenderer.invoke('read-project-tree', projectPath),
  refreshBranch: (projectPath: string) => ipcRenderer.invoke('refresh-branch', projectPath),
  getGitChanges: (projectPath: string) => ipcRenderer.invoke('git-changes', projectPath),
  getGitDiff: (projectPath: string, filePath: string) => ipcRenderer.invoke('git-diff', projectPath, filePath),
  getGitFileVersions: (projectPath: string, filePath: string) => ipcRenderer.invoke('git-file-versions', projectPath, filePath),
  discardGitChanges: (projectPath: string, filePath: string) => ipcRenderer.invoke('git-discard', projectPath, filePath),
  getProjectTasks: (projectPath: string, source: import('./services/tasks').TaskSource) => ipcRenderer.invoke('get-project-tasks', projectPath, source),
  readFileContent: (filePath: string) => ipcRenderer.invoke('read-file-content', filePath),
  writeFileContent: (filePath: string, content: string) => ipcRenderer.invoke('write-file-content', filePath, content),
  createFile: (filePath: string, content: string) => ipcRenderer.invoke('create-file', filePath, content),
  deleteFile: (filePath: string) => ipcRenderer.invoke('delete-file', filePath),
  ptySpawn: (tabId: string, projectPath: string, command?: string, title?: string) => ipcRenderer.invoke('pty-spawn', tabId, projectPath, command, title),
  ptyRead: (tabId: string) => ipcRenderer.invoke('pty-read', tabId),
  ptyIsAlive: (tabId: string) => ipcRenderer.invoke('pty-is-alive', tabId),
  ptyInput: (tabId: string, data: string) => ipcRenderer.invoke('pty-input', tabId, data),
  ptyResize: (tabId: string, cols: number, rows: number) => ipcRenderer.invoke('pty-resize', tabId, cols, rows),
  ptyKill: (tabId: string) => ipcRenderer.invoke('pty-kill', tabId),
  launchVscode: (projectPath: string) => ipcRenderer.invoke('launch-vscode', projectPath),
  launchTerminal: (kind: 'wt' | 'powershell') => ipcRenderer.invoke('launch-terminal', kind),
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
  onProjectBranchLoaded: (callback: (data: { path: string; branch: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { path: string; branch: string }) => callback(data);
    ipcRenderer.on('project-branch-loaded', handler);
    return () => ipcRenderer.removeListener('project-branch-loaded', handler);
  },
  onTasksChanged: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('tasks-changed', handler);
    return () => ipcRenderer.removeListener('tasks-changed', handler);
  },
  onPtyData: (callback: (tabId: string, data: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, tabId: string, data: string) => callback(tabId, data);
    ipcRenderer.on('pty-data', handler);
    return () => ipcRenderer.removeListener('pty-data', handler);
  },
  onPtyExit: (callback: (tabId: string, exitCode: number) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, tabId: string, exitCode: number) => callback(tabId, exitCode);
    ipcRenderer.on('pty-exit', handler);
    return () => ipcRenderer.removeListener('pty-exit', handler);
  },
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
} satisfies ElectronAPI);
