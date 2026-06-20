import { ipcMain, BrowserWindow } from 'electron';

export function registerWindowIpc(getWindow: () => BrowserWindow | null): void {
  // ── Window controls (frameless custom title bar) ─────────
  ipcMain.handle('window-minimize', () => {
    getWindow()?.minimize();
  });

  ipcMain.handle('window-maximize', () => {
    const win = getWindow();
    if (win?.isMaximized()) {
      win.unmaximize();
    } else {
      win?.maximize();
    }
  });

  ipcMain.handle('window-is-maximized', () => {
    return getWindow()?.isMaximized() ?? false;
  });

  ipcMain.handle('window-close', () => {
    getWindow()?.close();
  });
}
