import { app, BrowserWindow, Menu } from 'electron';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { PTYManager } from './pty-manager';
import { registerFilesystemIpc } from './ipc/filesystem.ipc';
import { registerGitIpc } from './ipc/git.ipc';
import { registerSettingsIpc } from './ipc/settings.ipc';
import { registerPtyIpc } from './ipc/pty.ipc';
import { registerWindowIpc } from './ipc/window.ipc';
import { registerTasksIpc } from './ipc/tasks.ipc';
import { registerDockerIpc } from './ipc/docker.ipc';
import { closeAllSessions } from './services/wsl-session';
import { loadSettings } from './services/settings';

let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;
let disposeTasksWatcher: (() => void) | null = null;
let ptyManager: PTYManager;

// Lightweight splash shown instantly while the main window loads in the
// background. Inlined as a data URL so no extra file needs bundling/copying.
const SPLASH_HTML = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  html,body{margin:0;height:100%;overflow:hidden;background:transparent;
    font-family:'Segoe UI',system-ui,sans-serif;-webkit-user-select:none;}
  .card{height:100vh;display:flex;flex-direction:column;align-items:center;
    justify-content:center;gap:18px;background:#050505;border:1px solid #1f1a15;
    border-radius:14px;box-shadow:0 0 40px rgba(212,120,74,0.12);}
  .logo{width:72px;height:72px;animation:float 3s ease-in-out infinite;
    filter:drop-shadow(0 0 12px rgba(212,120,74,0.35));}
  .name{font-size:12px;letter-spacing:.28em;text-transform:uppercase;
    color:rgba(212,120,74,.8);font-weight:500;}
  .bar{width:160px;height:3px;border-radius:3px;background:#1f1a15;overflow:hidden;}
  .bar i{display:block;height:100%;width:40%;border-radius:3px;
    background:linear-gradient(90deg,#8b5a3c,#d4784a,#e8956a);
    animation:slide 1.2s ease-in-out infinite;}
  @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
  @keyframes slide{0%{margin-left:-40%}100%{margin-left:100%}}
</style></head><body><div class="card">
  <svg class="logo" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><defs>
    <linearGradient id="g1" x1="12" y1="4" x2="52" y2="60" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#e8956a"/><stop offset="45%" stop-color="#d4784a"/><stop offset="100%" stop-color="#6b3a22"/></linearGradient>
    <linearGradient id="g2" x1="18" y1="18" x2="46" y2="46" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#f0c4a0"/><stop offset="30%" stop-color="#d4784a"/><stop offset="60%" stop-color="#8b5a3c"/><stop offset="100%" stop-color="#4a2a1a"/></linearGradient>
    <radialGradient id="g3" cx="32" cy="30" r="11" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#050505"/><stop offset="70%" stop-color="#0a0a0a"/><stop offset="100%" stop-color="#1a0a04"/></radialGradient></defs>
    <polygon points="32,3 55,16 55,44 32,57 9,44 9,16" fill="url(#g1)" opacity="0.9" stroke="#d4784a" stroke-width="1.2" stroke-linejoin="round"/>
    <circle cx="32" cy="30" r="15" fill="none" stroke="url(#g2)" stroke-width="7" opacity="0.9"/>
    <circle cx="32" cy="30" r="11" fill="url(#g3)"/>
    <circle cx="32" cy="30" r="11.5" fill="none" stroke="#f0ece8" stroke-width="0.8" opacity="0.35"/></svg>
  <div class="name">Focusxide Code Manager</div>
  <div class="bar"><i></i></div>
</div></body></html>`;

function createSplash(): void {
  splashWindow = new BrowserWindow({
    width: 320,
    height: 220,
    frame: false,
    transparent: true,
    resizable: false,
    center: true,
    alwaysOnTop: true,
    backgroundColor: '#00000000',
    webPreferences: { sandbox: true },
  });
  splashWindow.loadURL('data:text/html;charset=UTF-8,' + encodeURIComponent(SPLASH_HTML));
  splashWindow.on('closed', () => {
    splashWindow = null;
  });
}

function createWindow(): void {
  const preloadPath = path.join(__dirname, 'preload.js');

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    frame: false,
    backgroundColor: '#050505',
    autoHideMenuBar: true,
    titleBarOverlay: {
      color: '#050505',
      symbolColor: '#f0ece8',
      height: 36,
    },
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Reveal the main window only once its first frame is painted, then drop
  // the splash. Avoids the long white-screen flash during startup.
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    splashWindow?.destroy();
  });

  // ponytail: safety net so a missed 'ready-to-show' can't leave the splash stuck.
  setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) {
      mainWindow.show();
      splashWindow?.destroy();
    }
  }, 15000);

  // Notify renderer when maximize state changes
  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('window-maximized-changed', true);
  });
  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('window-maximized-changed', false);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function registerIpcHandlers(): void {
  const getWindow = () => mainWindow;
  registerFilesystemIpc(getWindow);
  registerGitIpc();
  registerSettingsIpc();
  registerPtyIpc(ptyManager);
  registerWindowIpc(getWindow);
  disposeTasksWatcher = registerTasksIpc(getWindow);
  registerDockerIpc();
}

// ── App Lifecycle ─────────────────────────────────────────────

app.whenReady().then(() => {
  // ponytail: remove default menu so its Ctrl+C/V accelerators don't swallow
  // key events before they reach xterm's attachCustomKeyEventHandler (canvas
  // has no DOM selection, so the native "Copy" accelerator copies nothing).
  Menu.setApplicationMenu(null);

  // PTYManager pushes output to the renderer in real-time via webContents.send.
  // The callback is sandbox-compatible because preload.ts bridges it with
  // ipcRenderer.on + contextBridge (same pattern as window-maximized-changed).
  ptyManager = new PTYManager((channel, tabId, data) => {
    mainWindow?.webContents.send(channel, tabId, data);
  });
  registerIpcHandlers();
  createSplash();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('before-quit', () => {
  ptyManager.killAll();
  disposeTasksWatcher?.();
  closeAllSessions();
  // Stop Docker on exit so it doesn't linger — only if WSL is enabled in config.
  // Surgical: stops just the daemon, not the whole WSL. Needs the NOPASSWD sudoers rule.
  const settings = loadSettings();
  if (settings.useWsl2Git) {
    const distro = settings.wslDistro || 'Ubuntu';
    spawnSync('wsl.exe', ['-d', distro, '--', 'bash', '-lc', 'sudo -n systemctl stop docker.service docker.socket'], { windowsHide: true, timeout: 15_000 });
  }
});
