import { ipcMain } from 'electron';
import { curate } from '../services/ai';

/** Registers the AI curator IPC (Flujo 2). */
export function registerAiIpc(): void {
  ipcMain.handle('curate:run', async (_event, text: string) => {
    try {
      return { ok: true as const, text: await curate(text) };
    } catch (err) {
      return { ok: false as const, error: err instanceof Error ? err.message : String(err) };
    }
  });
}
