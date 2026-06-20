import { ipcMain } from 'electron';
import { getGitBranch, getGitChanges, getGitDiff, getGitFileVersions, discardFileChanges } from '../services/git';

export function registerGitIpc(): void {
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

  ipcMain.handle('git-discard', async (_event, projectPath: string, filePath: string) => {
    return discardFileChanges(projectPath, filePath);
  });
}
