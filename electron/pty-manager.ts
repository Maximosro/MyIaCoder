import * as nodePty from 'node-pty';
import { registerClaudeSession, unregisterClaudeSession, registerCopilotSession, unregisterCopilotSession, registerReasonixSession, unregisterReasonixSession } from './services/tasks';
import { loadSettings } from './services/settings';
import { toWslPath, shQuote } from './services/wsl-session';

/**
 * Sanitises a tab title for safe use inside a cmd.exe command line.
 * Keeps only letters, digits, spaces and a few separators — this both prevents
 * command injection (the title is user input) and avoids quoting headaches.
 */
function sanitizeSessionName(title: string): string {
  return title.replace(/[^\p{L}\p{N} _.\-]/gu, '').trim().slice(0, 60) || 'session';
}

/**
 * Builds the CLI launch command. For Copilot, binds the session to the tab's
 * UUID (`--session-id`) and labels it with the tab title (`--name`), so the
 * task panel can map each live session back to its terminal tab exactly.
 * Other commands (e.g. 'claude') are launched as-is.
 */
function buildLaunchCommand(command: string, tabId: string, projectPath: string, title?: string): string {
  // Plain terminal tab: open the shell at the project path without running any CLI.
  if (command === 'terminal') {
    return '';
  }
  if (command === 'copilot' || command === 'claude') {
    const name = sanitizeSessionName(title ?? '');
    return `${command} --session-id=${tabId} --name="${name}"`;
  }
  // Reasonix ≥ 1.8.0 auto-generates session names — the --session flag was
  // removed.  The task panel shows all sessions for a project as long as a
  // Reasonix terminal tab is open, because session files are created lazily
  // (when the user first types a message).
  if (command === 'reasonix') {
    return `reasonix chat --dir="${projectPath}"`;
  }
  return command;
}

interface PTYSession {
  pty: nodePty.IPty;
  projectPath: string;
  buffer: string[];  // ponytail: kept for dual-write during push transition
}

/**
 * Manages PTY sessions for terminal tabs.
 * Data is pushed to the renderer in real-time via a sendToRenderer callback
 * (sandbox-compatible when bridged through contextBridge + ipcRenderer.on).
 * The legacy buffer + polling path is kept as fallback during transition.
 */
export class PTYManager {
  private sessions = new Map<string, PTYSession>();
  private sendToRenderer: (channel: string, tabId: string, data: string | number) => void;

  constructor(sendToRenderer: (channel: string, tabId: string, data: string | number) => void = () => {}) {
    this.sendToRenderer = sendToRenderer;
  }

  spawn(tabId: string, projectPath: string, command: string = 'claude', title?: string): void {
    this.kill(tabId);

    // Copilot needs to run *inside* WSL2 (not just git) so the AI tracker hooks
    // fire there. Other clients stay on cmd.exe (legacy).
    const settings = loadSettings();
    const useWsl = command === 'copilot' && settings.useWsl2Git;
    const distro = settings.wslDistro || 'Ubuntu';

    const pty = useWsl
      ? nodePty.spawn('wsl.exe', ['-d', distro], {
          cwd: projectPath,
          env: {
            ...process.env,
            TERM: 'xterm-256color',
            COLUMNS: '80',
            LINES: '24',
          },
          cols: 80,
          rows: 24,
          name: 'xterm-256color',
        })
      : nodePty.spawn('cmd.exe', [], {
          cwd: projectPath,
          env: {
            ...process.env,
            TERM: 'xterm-256color',
            COLUMNS: '80',
            LINES: '24',
          },
          cols: 80,
          rows: 24,
          name: 'xterm-256color',
        });

    const session: PTYSession = { pty, projectPath, buffer: [] };
    this.sessions.set(tabId, session);

    pty.onData((data: string) => {
      // Push to renderer in real-time (replaces polling latency)
      this.sendToRenderer('pty-data', tabId, data);
      // Dual-write to buffer for legacy polling compatibility
      session.buffer.push(data);
    });

    pty.onExit(({ exitCode }) => {
      const msg = `\r\n\x1b[33mProcess exited with code ${exitCode ?? -1}\x1b[0m\r\n`;
      this.sendToRenderer('pty-data', tabId, msg);
      this.sendToRenderer('pty-exit', tabId, exitCode ?? -1);
      session.buffer.push(msg);
    });

    // Type the command and press enter — exactly like the user would.
    // An empty command (plain terminal) leaves the shell at the project path untouched.
    const launchCommand = buildLaunchCommand(command, tabId, projectPath, title);
    if (launchCommand) {
      // In WSL the cmd.exe cwd doesn't carry over, so cd into the mounted path first.
      const cmd = useWsl ? `cd ${shQuote(toWslPath(projectPath))} && ${launchCommand}` : launchCommand;
      pty.write(`${cmd}\r\n`);
    }

    // Track this session so the task panel can discover its subagents/tasks,
    // and so external (non-app) CLI sessions stay hidden from the panel.
    if (command === 'claude') {
      registerClaudeSession(tabId);
    } else if (command === 'copilot') {
      registerCopilotSession(tabId);
    } else if (command === 'reasonix') {
      // Reasonix ≥ 1.8.0 creates session files lazily (on first message).
      // Instead of discovering a specific file, we mark this project as
      // having an open Reasonix tab — getReasonixTasks shows ALL sessions
      // for a project that has at least one open tab.
      registerReasonixSession(tabId, projectPath);
    }
  }

  /** Read and clear buffered data for a tab. Called by renderer via polling. */
  read(tabId: string): string | null {
    const session = this.sessions.get(tabId);
    if (!session) return null;
    if (session.buffer.length === 0) return '';
    const data = session.buffer.join('');
    session.buffer.length = 0;
    return data;
  }

  /** Returns true if the tab's PTY process is still alive. */
  isAlive(tabId: string): boolean {
    return this.sessions.has(tabId);
  }

  input(tabId: string, data: string): void {
    const session = this.sessions.get(tabId);
    if (session) session.pty.write(data);
  }

  resize(tabId: string, cols: number, rows: number): void {
    const session = this.sessions.get(tabId);
    if (session) {
      try { session.pty.resize(cols, rows); } catch { /* ignore */ }
    }
  }

  kill(tabId: string): void {
    const session = this.sessions.get(tabId);
    if (session) {
      session.pty.kill();
      this.sessions.delete(tabId);
      unregisterClaudeSession(tabId);
      unregisterCopilotSession(tabId);
      unregisterReasonixSession(tabId);
    }
  }

  killAll(): void {
    for (const [tabId, session] of this.sessions) {
      session.pty.kill();
      unregisterClaudeSession(tabId);
      unregisterCopilotSession(tabId);
      unregisterReasonixSession(tabId);
    }
    this.sessions.clear();
  }
}
