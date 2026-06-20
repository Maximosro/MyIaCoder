import { ipcMain } from 'electron';
import { loadSettings, saveSettings } from '../services/settings';
import type { Settings } from '../services/settings';

export function registerSettingsIpc(): void {
  ipcMain.handle('get-settings', async () => loadSettings());

  ipcMain.handle('save-settings', async (_event, settings: Settings) => {
    saveSettings(settings);
  });
}
