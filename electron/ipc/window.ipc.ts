import { app, ipcMain, BrowserWindow } from 'electron';

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

  // ── App metadata ────────────────────────────────────────
  ipcMain.handle('get-app-version', () => app.getVersion());

  // Restart the whole app (used when toggling WSL git mode so the change takes
  // effect with a clean state: no stale WSL session, branch badges re-evaluated).
  ipcMain.handle('app-relaunch', () => {
    app.relaunch();
    app.exit(0);
  });
}
