import { ipcMain, dialog, shell, BrowserWindow } from 'electron';
import path from 'node:path';
import { exec } from 'node:child_process';
import {
  listWorkspaceProjects,
  readDirectoryTree,
  readProjectFileTree,
  readFileContent,
  writeFileContent,
  createFile,
  deleteEntry,
} from '../services/filesystem';
import { getGitBranchAsync } from '../services/git';
import { loadSettings } from '../services/settings';
import type { Settings } from '../services/settings';

/** Throws PATH_TRAVERSAL if filePath resolves outside the allowed workspace/plans/skills roots. */
function assertPathAllowed(filePath: string, settings: Settings): void {
  const resolved = path.resolve(filePath);
  const roots = [settings.workspacePath, settings.plansPath, settings.skillsPath, settings.promptsPath]
    .filter(Boolean)
    .map((root) => path.resolve(root));
  if (!roots.some((root) => resolved.startsWith(root))) {
    throw new Error('PATH_TRAVERSAL');
  }
}

export function registerFilesystemIpc(getWindow: () => BrowserWindow | null): void {
  // Bumped on every list-projects call so a previous background branch loader
  // stops sending stale updates when the list is refreshed.
  let branchLoadGeneration = 0;

  // ponytail: sequential branch loading. If a workspace has hundreds of repos
  // and load time matters, batch a few in parallel — sequential keeps it light.
  async function loadBranchesSequentially(
    projects: { path: string }[],
    generation: number,
  ): Promise<void> {
    for (const project of projects) {
      if (generation !== branchLoadGeneration) return; // superseded by a refresh
      const branch = await getGitBranchAsync(project.path);
      if (generation !== branchLoadGeneration) return;
      getWindow()?.webContents.send('project-branch-loaded', { path: project.path, branch });
    }
  }

  ipcMain.handle('list-projects', async () => {
    const settings = loadSettings();
    const projects = listWorkspaceProjects(settings.workspacePath);
    const generation = ++branchLoadGeneration;
    // Fire-and-forget: return the list immediately so the UI is usable,
    // then stream branches in one at a time.
    void loadBranchesSequentially(projects, generation);
    return projects;
  });

  ipcMain.handle('read-plans-tree', async () => {
    const settings = loadSettings();
    return readDirectoryTree(settings.plansPath);
  });

  ipcMain.handle('read-skills-tree', async () => {
    const settings = loadSettings();
    return readDirectoryTree(settings.skillsPath);
  });

  ipcMain.handle('read-prompts-tree', async () => {
    const settings = loadSettings();
    return readDirectoryTree(settings.promptsPath);
  });

  ipcMain.handle('read-project-tree', async (_event, projectPath: string) => {
    return readProjectFileTree(projectPath);
  });

  ipcMain.handle('read-file-content', async (_event, filePath: string) => {
    assertPathAllowed(filePath, loadSettings());
    return readFileContent(filePath);
  });

  ipcMain.handle('write-file-content', async (_event, filePath: string, content: string) => {
    assertPathAllowed(filePath, loadSettings());
    writeFileContent(filePath, content);
  });

  ipcMain.handle('create-file', async (_event, filePath: string, content: string) => {
    assertPathAllowed(filePath, loadSettings());
    createFile(filePath, content ?? '');
  });

  ipcMain.handle('delete-file', async (_event, filePath: string) => {
    assertPathAllowed(filePath, loadSettings());
    deleteEntry(filePath);
  });

  ipcMain.handle('pick-workspace', async () => {
    const win = getWindow();
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
      title: 'Select Workspace Folder',
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('pick-folder', async (_event, title: string) => {
    const win = getWindow();
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
      title,
    });
    return result.canceled ? null : result.filePaths[0];
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
}
