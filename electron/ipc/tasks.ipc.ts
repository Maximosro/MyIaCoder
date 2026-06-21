import { ipcMain, BrowserWindow } from 'electron';
import { getProjectTasks, watchTasks, type TaskSource } from '../services/tasks';

/**
 * Registers task-related IPC and starts a single filesystem watcher that
 * notifies the renderer ('tasks-changed') whenever any CLI session store
 * changes, so open task panels refresh live.
 */
export function registerTasksIpc(getWindow: () => BrowserWindow | null): () => void {
  ipcMain.handle('get-project-tasks', async (_event, projectPath: string, source: TaskSource) => {
    return getProjectTasks(projectPath, source);
  });

  return watchTasks(() => {
    getWindow()?.webContents.send('tasks-changed');
  });
}
