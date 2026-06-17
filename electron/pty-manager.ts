import * as nodePty from 'node-pty';

interface PTYSession {
  pty: nodePty.IPty;
  projectPath: string;
  buffer: string[];
}

/**
 * Manages PTY sessions for terminal tabs.
 * Data is buffered per-tab and consumed by the renderer via polling (pty-read IPC).
 * This avoids the sandbox-incompatible webContents.send pattern.
 */
export class PTYManager {
  private sessions = new Map<string, PTYSession>();

  spawn(tabId: string, projectPath: string, command: string = 'claude'): void {
    this.kill(tabId);

    const pty = nodePty.spawn('cmd.exe', [], {
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
      session.buffer.push(data);
    });

    pty.onExit(({ exitCode }) => {
      session.buffer.push(`\r\n\x1b[33mProcess exited with code ${exitCode ?? -1}\x1b[0m\r\n`);
    });

    // Type the command and press enter — exactly like the user would
    pty.write(`${command}\r\n`);
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
    }
  }

  killAll(): void {
    for (const [, session] of this.sessions) {
      session.pty.kill();
    }
    this.sessions.clear();
  }
}
