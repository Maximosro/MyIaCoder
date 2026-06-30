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
  templatesPath: string;
  todosPath: string;
  theme: 'system' | 'light' | 'dark';
  clients: ClientsConfig;
  terminalScrollback: number;
  backgroundMusic: boolean;
  onboardingComplete: boolean;
  useWsl2Git: boolean;
  wslDistro: string;
  groqApiKey: string;
  runConfigs: Record<string, RunConfig>;
  recentProjects: string[];
}

export interface RunConfig {
  command: string;
  useWsl: boolean;
}

export interface PromptTemplate {
  id: string;
  name: string;
  content: string;
}

export interface ElectronAPI {
  listProjects: () => Promise<Project[]>;
  readPlansTree: () => Promise<TreeNode[]>;
  readSkillsTree: () => Promise<TreeNode[]>;
  readPromptsTree: () => Promise<TreeNode[]>;
  readTemplatesTree: () => Promise<TreeNode[]>;
  readTemplates: () => Promise<PromptTemplate[]>;
  readProjectTree: (projectPath: string) => Promise<TreeNode[]>;
  refreshBranch: (projectPath: string) => Promise<string>;
  wslPrewarm: (projectPath: string) => Promise<void>;
  wslCloseAll: () => Promise<void>;
  getGitChanges: (projectPath: string) => Promise<import('./services/git').GitChangesResult>;
  getGitDiff: (projectPath: string, filePath: string) => Promise<string>;
  getGitFileVersions: (projectPath: string, filePath: string) => Promise<import('./services/git').GitFileVersions>;
  discardGitChanges: (projectPath: string, filePath: string) => Promise<import('./services/git').DiscardResult>;
  gitFetch: (projectPath: string) => Promise<import('./services/git').GitRemoteResult>;
  gitPull: (projectPath: string) => Promise<import('./services/git').GitRemoteResult>;
  gitPush: (projectPath: string) => Promise<import('./services/git').GitRemoteResult>;
  gitAheadBehind: (projectPath: string) => Promise<import('./services/git').GitAheadBehind>;
  gitCommit: (projectPath: string, message: string) => Promise<import('./services/git').GitRemoteResult>;
  gitListBranches: (projectPath: string) => Promise<import('./services/git').GitBranchList>;
  gitCreateBranch: (projectPath: string, name: string, base?: string) => Promise<import('./services/git').GitRemoteResult>;
  gitSwitchBranch: (projectPath: string, branch: string) => Promise<import('./services/git').GitRemoteResult>;
  getProjectTasks: (projectPath: string, source: import('./services/tasks').TaskSource) => Promise<import('./services/tasks').ProjectTasksResult>;
  listProjectSessions: (projectPath: string) => Promise<import('./services/sessions').SessionListResult>;
  getSessionTranscript: (source: import('./services/sessions').SessionSource, sessionId: string, projectPath: string) => Promise<import('./services/sessions').TranscriptResult>;
  readFileContent: (filePath: string) => Promise<string>;
  writeFileContent: (filePath: string, content: string) => Promise<void>;
  createFile: (filePath: string, content: string) => Promise<void>;
  deleteFile: (filePath: string) => Promise<void>;
  ensureProjectTodos: (projectName: string) => Promise<string>;
  ptySpawn: (tabId: string, projectPath: string, command?: string, title?: string, useWsl?: boolean) => Promise<void>;
  ptyRead: (tabId: string) => Promise<string | null>;
  ptyIsAlive: (tabId: string) => Promise<boolean>;
  ptyInput: (tabId: string, data: string) => Promise<void>;
  ptyResize: (tabId: string, cols: number, rows: number) => Promise<void>;
  ptyKill: (tabId: string) => Promise<void>;
  launchVscode: (projectPath: string) => Promise<void>;
  launchTerminal: (kind: 'wt' | 'powershell') => Promise<void>;
  pickComposeFile: (defaultPath?: string) => Promise<string | null>;
  dockerStartEngine: () => Promise<import('./services/docker').DockerResult>;
  dockerStopEngine: () => Promise<import('./services/docker').DockerResult>;
  dockerComposeUp: (composePath: string) => Promise<import('./services/docker').DockerResult>;
  dockerComposeTerminal: (composePath: string) => Promise<void>;
  dockerListContainers: () => Promise<import('./services/docker').DockerPsResult>;
  dockerStopContainer: (id: string) => Promise<import('./services/docker').DockerResult>;
  getSettings: () => Promise<Settings>;
  saveSettings: (settings: Settings) => Promise<void>;
  pickWorkspace: () => Promise<string | null>;
  pickFolder: (title: string) => Promise<string | null>;
  // Window controls (frameless custom title bar)
  windowMinimize: () => Promise<void>;
  windowMaximize: () => Promise<void>;
  windowIsMaximized: () => Promise<boolean>;
  windowClose: () => Promise<void>;
  clipboardWriteText: (text: string) => Promise<void>;
  clipboardReadText: () => Promise<string>;
  onMaximizedChanged: (callback: (isMaximized: boolean) => void) => () => void;
  onProjectBranchLoaded: (callback: (data: { path: string; branch: string }) => void) => () => void;
  onTasksChanged: (callback: () => void) => () => void;
  getAppVersion: () => Promise<string>;
  relaunchApp: () => Promise<void>;
  voiceTranscribe: (audio: ArrayBuffer, mimeType: string) => Promise<{ ok: true; text: string } | { ok: false; error: string }>;
  voiceSynthesize: (text: string) => Promise<{ ok: true; audio: ArrayBuffer } | { ok: false; error: string }>;
  voiceStatus: () => Promise<{ running: boolean }>;
  curate: (text: string) => Promise<{ ok: true; text: string } | { ok: false; error: string }>;
  onPtyData: (callback: (tabId: string, data: string) => void) => () => void;
  onPtyExit: (callback: (tabId: string, exitCode: number) => void) => () => void;
}

contextBridge.exposeInMainWorld('electronAPI', {
  listProjects: () => ipcRenderer.invoke('list-projects'),
  readPlansTree: () => ipcRenderer.invoke('read-plans-tree'),
  readSkillsTree: () => ipcRenderer.invoke('read-skills-tree'),
  readPromptsTree: () => ipcRenderer.invoke('read-prompts-tree'),
  readTemplatesTree: () => ipcRenderer.invoke('read-templates-tree'),
  readTemplates: () => ipcRenderer.invoke('read-templates'),
  readProjectTree: (projectPath: string) => ipcRenderer.invoke('read-project-tree', projectPath),
  refreshBranch: (projectPath: string) => ipcRenderer.invoke('refresh-branch', projectPath),
  wslPrewarm: (projectPath: string) => ipcRenderer.invoke('wsl-prewarm', projectPath),
  wslCloseAll: () => ipcRenderer.invoke('wsl-close-all'),
  getGitChanges: (projectPath: string) => ipcRenderer.invoke('git-changes', projectPath),
  getGitDiff: (projectPath: string, filePath: string) => ipcRenderer.invoke('git-diff', projectPath, filePath),
  getGitFileVersions: (projectPath: string, filePath: string) => ipcRenderer.invoke('git-file-versions', projectPath, filePath),
  discardGitChanges: (projectPath: string, filePath: string) => ipcRenderer.invoke('git-discard', projectPath, filePath),
  gitFetch: (projectPath: string) => ipcRenderer.invoke('git-fetch', projectPath),
  gitPull: (projectPath: string) => ipcRenderer.invoke('git-pull', projectPath),
  gitPush: (projectPath: string) => ipcRenderer.invoke('git-push', projectPath),
  gitAheadBehind: (projectPath: string) => ipcRenderer.invoke('git-ahead-behind', projectPath),
  gitCommit: (projectPath: string, message: string) => ipcRenderer.invoke('git-commit', projectPath, message),
  gitListBranches: (projectPath: string) => ipcRenderer.invoke('git-list-branches', projectPath),
  gitCreateBranch: (projectPath: string, name: string, base?: string) => ipcRenderer.invoke('git-create-branch', projectPath, name, base),
  gitSwitchBranch: (projectPath: string, branch: string) => ipcRenderer.invoke('git-switch-branch', projectPath, branch),
  getProjectTasks: (projectPath: string, source: import('./services/tasks').TaskSource) => ipcRenderer.invoke('get-project-tasks', projectPath, source),
  listProjectSessions: (projectPath: string) => ipcRenderer.invoke('list-project-sessions', projectPath),
  getSessionTranscript: (source: import('./services/sessions').SessionSource, sessionId: string, projectPath: string) => ipcRenderer.invoke('get-session-transcript', source, sessionId, projectPath),
  readFileContent: (filePath: string) => ipcRenderer.invoke('read-file-content', filePath),
  writeFileContent: (filePath: string, content: string) => ipcRenderer.invoke('write-file-content', filePath, content),
  createFile: (filePath: string, content: string) => ipcRenderer.invoke('create-file', filePath, content),
  deleteFile: (filePath: string) => ipcRenderer.invoke('delete-file', filePath),
  ensureProjectTodos: (projectName: string) => ipcRenderer.invoke('ensure-project-todos', projectName),
  ptySpawn: (tabId: string, projectPath: string, command?: string, title?: string, useWsl?: boolean) => ipcRenderer.invoke('pty-spawn', tabId, projectPath, command, title, useWsl),
  ptyRead: (tabId: string) => ipcRenderer.invoke('pty-read', tabId),
  ptyIsAlive: (tabId: string) => ipcRenderer.invoke('pty-is-alive', tabId),
  ptyInput: (tabId: string, data: string) => ipcRenderer.invoke('pty-input', tabId, data),
  ptyResize: (tabId: string, cols: number, rows: number) => ipcRenderer.invoke('pty-resize', tabId, cols, rows),
  ptyKill: (tabId: string) => ipcRenderer.invoke('pty-kill', tabId),
  launchVscode: (projectPath: string) => ipcRenderer.invoke('launch-vscode', projectPath),
  launchTerminal: (kind: 'wt' | 'powershell') => ipcRenderer.invoke('launch-terminal', kind),
  pickComposeFile: (defaultPath?: string) => ipcRenderer.invoke('pick-compose-file', defaultPath),
  dockerStartEngine: () => ipcRenderer.invoke('docker-start-engine'),
  dockerStopEngine: () => ipcRenderer.invoke('docker-stop-engine'),
  dockerComposeUp: (composePath: string) => ipcRenderer.invoke('docker-compose-up', composePath),
  dockerComposeTerminal: (composePath: string) => ipcRenderer.invoke('docker-compose-terminal', composePath),
  dockerListContainers: () => ipcRenderer.invoke('docker-ps'),
  dockerStopContainer: (id: string) => ipcRenderer.invoke('docker-stop', id),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings: Settings) => ipcRenderer.invoke('save-settings', settings),
  pickWorkspace: () => ipcRenderer.invoke('pick-workspace'),
  pickFolder: (title: string) => ipcRenderer.invoke('pick-folder', title),
  // Window controls (frameless custom title bar)
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowMaximize: () => ipcRenderer.invoke('window-maximize'),
  windowIsMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  windowClose: () => ipcRenderer.invoke('window-close'),
  clipboardWriteText: (text: string) => ipcRenderer.invoke('clipboard-write', text),
  clipboardReadText: () => ipcRenderer.invoke('clipboard-read'),
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
  relaunchApp: () => ipcRenderer.invoke('app-relaunch'),
  voiceTranscribe: (audio: ArrayBuffer, mimeType: string) => ipcRenderer.invoke('voice:transcribe', audio, mimeType),
  voiceSynthesize: (text: string) => ipcRenderer.invoke('voice:synthesize', text),
  voiceStatus: () => ipcRenderer.invoke('voice:status'),
  curate: (text: string) => ipcRenderer.invoke('curate:run', text),
} satisfies ElectronAPI);
