import { ipcMain } from 'electron';
import { listProjectSessions, getTranscript, type SessionSource } from '../services/sessions';

/** Registers session-history IPC: list a project's CLI sessions and read one
 *  session's clean transcript (user/assistant only). Read-only, on demand. */
export function registerSessionsIpc(): void {
  ipcMain.handle('list-project-sessions', async (_event, projectPath: string) => {
    return listProjectSessions(projectPath);
  });

  ipcMain.handle('get-session-transcript', async (_event, source: SessionSource, sessionId: string, projectPath: string) => {
    return getTranscript(source, sessionId, projectPath);
  });
}
