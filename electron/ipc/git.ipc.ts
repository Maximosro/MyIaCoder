import { ipcMain } from 'electron';
import { getGitBranch, getGitChanges, getGitDiff, getGitFileVersions, discardFileChanges, gitFetch, gitPull, gitPush, gitAheadBehind, gitCommit } from '../services/git';
import { prewarmSession, closeAllSessions } from '../services/wsl-session';

export function registerGitIpc(): void {
  ipcMain.handle('refresh-branch', async (_event, projectPath: string) => {
    return getGitBranch(projectPath);
  });

  // Starts the persistent WSL session for a project (WSL git mode) so later
  // commit/push/status reuse it instead of spawning `wsl` per command.
  ipcMain.handle('wsl-prewarm', async (_event, projectPath: string) => {
    // Warm the session with a `git status` so cwd + distro are ready before the
    // user's first real command. Fire-and-forget.
    prewarmSession(projectPath).run(['status', '--porcelain']).catch(() => {});
  });

  ipcMain.handle('wsl-close-all', async () => {
    closeAllSessions();
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

  ipcMain.handle('git-fetch', async (_event, projectPath: string) => {
    return gitFetch(projectPath);
  });

  ipcMain.handle('git-pull', async (_event, projectPath: string) => {
    return gitPull(projectPath);
  });

  ipcMain.handle('git-push', async (_event, projectPath: string) => {
    return gitPush(projectPath);
  });

  ipcMain.handle('git-ahead-behind', async (_event, projectPath: string) => {
    return gitAheadBehind(projectPath);
  });

  ipcMain.handle('git-commit', async (_event, projectPath: string, message: string) => {
    return gitCommit(projectPath, message);
  });
}
