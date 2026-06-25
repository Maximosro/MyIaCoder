import { ipcMain } from 'electron';
import type { PTYManager } from '../pty-manager';

export function registerPtyIpc(ptyManager: PTYManager): void {
  // PTY handlers — polling-based (no webContents.send, sandbox-compatible)
  ipcMain.handle('pty-spawn', async (_event, tabId: string, projectPath: string, command?: string, title?: string, useWsl?: boolean) => {
    ptyManager.spawn(tabId, projectPath, command, title, useWsl);
  });

  ipcMain.handle('pty-read', async (_event, tabId: string) => {
    return ptyManager.read(tabId);
  });

  ipcMain.handle('pty-is-alive', async (_event, tabId: string) => {
    return ptyManager.isAlive(tabId);
  });

  ipcMain.handle('pty-input', async (_event, tabId: string, data: string) => {
    ptyManager.input(tabId, data);
  });

  ipcMain.handle('pty-resize', async (_event, tabId: string, cols: number, rows: number) => {
    ptyManager.resize(tabId, cols, rows);
  });

  ipcMain.handle('pty-kill', async (_event, tabId: string) => {
    ptyManager.kill(tabId);
  });
}
