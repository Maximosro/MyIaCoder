import { ipcMain } from 'electron';
import { exec } from 'node:child_process';
import { startDockerEngine, stopDockerEngine, composeUp, composeTerminalCommand, listContainers, stopContainer } from '../services/docker';
import { loadSettings } from '../services/settings';
import type { DockerResult, DockerPsResult } from '../services/docker';

export function registerDockerIpc(): void {
  ipcMain.handle('docker-start-engine', async (): Promise<DockerResult> => startDockerEngine());

  ipcMain.handle('docker-stop-engine', async (): Promise<DockerResult> => stopDockerEngine());

  ipcMain.handle('docker-compose-up', async (_event, composePath: string): Promise<DockerResult> =>
    composeUp(composePath),
  );

  ipcMain.handle('docker-ps', async (): Promise<DockerPsResult> => listContainers());

  ipcMain.handle('docker-stop', async (_event, id: string): Promise<DockerResult> => stopContainer(id));

  // Opens an external terminal that re-runs the compose up live (used to show
  // the failure detail). Fire-and-forget; Windows-only.
  ipcMain.handle('docker-compose-terminal', async (_event, composePath: string): Promise<void> => {
    if (process.platform !== 'win32') return;
    const distro = (() => {
      try { return loadSettings().wslDistro || 'Ubuntu'; } catch { return 'Ubuntu'; }
    })();
    exec(composeTerminalCommand(distro, composePath));
  });
}
