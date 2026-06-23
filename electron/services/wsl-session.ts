import { spawn, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { loadSettings } from './settings';

/**
 * Converts a Windows path (`C:\a\b`) to its WSL mount path (`/mnt/c/a/b`).
 * Only the project path (the `-C` / `cd` value) is converted; repo-relative
 * file arguments already use forward slashes and need no translation.
 */
// ponytail: regex C:\ -> /mnt/c/. For UNC or exotic paths, swap to `wslpath`.
export function toWslPath(winPath: string): string {
  return winPath
    .replace(/^([A-Za-z]):/, (_m, drive: string) => `/mnt/${drive.toLowerCase()}`)
    .replace(/\\/g, '/');
}

/**
 * POSIX single-quote a shell argument. The persistent session writes commands
 * to a bash stdin, so every argument (commit messages, file paths — user/repo
 * controlled) MUST be quoted to avoid shell injection at this trust boundary.
 */
export function shQuote(arg: string): string {
  return `'${arg.replace(/'/g, `'\\''`)}'`;
}

/** Result of running a git command inside a persistent WSL session. */
export interface WslGitResult {
  stdout: string; // command output (stderr merged via `exec 2>&1`)
  code: number;   // git exit code
}

const DEFAULT_TIMEOUT = 15_000;

/**
 * A long-lived `wsl -d <distro> bash` process bound to one project directory.
 * Commands are written to its stdin and delimited by a per-session random
 * sentinel so we can read each command's output and exit code back. Commands
 * are serialized (one at a time) so outputs never interleave.
 */
class WslSession {
  readonly projectPath: string;
  private proc: ChildProcess;
  private nonce: string;
  private buf = '';
  private errBuf = '';
  private dead = false;
  private current: { resolve: (r: WslGitResult) => void; reject: (e: Error) => void } | null = null;
  private chain: Promise<unknown> = Promise.resolve();

  constructor(projectPath: string, distro: string) {
    this.projectPath = projectPath;
    this.nonce = randomBytes(8).toString('hex');

    // Pipe stdin → non-interactive bash (no PS1 prompt noise to parse).
    this.proc = spawn('wsl.exe', ['-d', distro, 'bash'], {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.proc.stdout!.setEncoding('utf-8');
    this.proc.stderr!.setEncoding('utf-8');
    this.proc.stdout!.on('data', (d: string) => this.onData(d));
    // Pre-`exec 2>&1` errors (e.g. a failing cd) land here; keep for diagnostics.
    this.proc.stderr!.on('data', (d: string) => { this.errBuf = (this.errBuf + d).slice(-2000); });
    this.proc.on('exit', () => this.fail(new Error(this.errBuf.trim() || 'WSL session ended')));
    this.proc.on('error', (e) => this.fail(e instanceof Error ? e : new Error('WSL spawn failed')));

    // Enter the repo and merge stderr→stdout so a single ordered stream carries
    // both git output and the sentinel.
    this.proc.stdin!.write(`cd ${shQuote(toWslPath(projectPath))} || exit 1\nexec 2>&1\n`);
  }

  isDead(): boolean {
    return this.dead;
  }

  /** Runs `git <args>` in the session. Serialized; resolves with output+code. */
  run(args: string[], timeoutMs: number = DEFAULT_TIMEOUT): Promise<WslGitResult> {
    const result = this.chain.then(() => this.exec(args, timeoutMs));
    // Keep the chain alive even if this command rejects, so later ones still run.
    this.chain = result.catch(() => {});
    return result;
  }

  private exec(args: string[], timeoutMs: number): Promise<WslGitResult> {
    if (this.dead) return Promise.reject(new Error('WSL session is dead'));
    return new Promise<WslGitResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.current = null;
        this.dispose(new Error('WSL git command timed out'));
        reject(new Error('WSL git command timed out'));
      }, timeoutMs);

      this.current = {
        resolve: (r) => { clearTimeout(timer); resolve(r); },
        reject: (e) => { clearTimeout(timer); reject(e); },
      };

      const cmd = 'git ' + args.map(shQuote).join(' ');
      this.proc.stdin!.write(`${cmd}\nprintf '\\n__DONE_${this.nonce} %d\\n' $?\n`);
    });
  }

  private onData(chunk: string): void {
    this.buf += chunk;
    if (!this.current) return;
    // Sentinel line emitted by printf: \n__DONE_<nonce> <code>\n
    const re = new RegExp(`\\n__DONE_${this.nonce} (\\d+)\\n`);
    const m = re.exec(this.buf);
    if (!m) return;
    const stdout = this.buf.slice(0, m.index);
    const code = parseInt(m[1], 10);
    this.buf = this.buf.slice(m.index + m[0].length);
    const cur = this.current;
    this.current = null;
    cur.resolve({ stdout, code });
  }

  private fail(err: Error): void {
    this.dead = true;
    if (this.current) {
      const cur = this.current;
      this.current = null;
      cur.reject(err);
    }
  }

  /** Kills the bash process and rejects any in-flight command. */
  dispose(err: Error = new Error('WSL session closed')): void {
    if (this.dead) {
      this.fail(err);
      return;
    }
    this.dead = true;
    try { this.proc.stdin!.end(); } catch { /* already gone */ }
    try { this.proc.kill(); } catch { /* already gone */ }
    if (this.current) {
      const cur = this.current;
      this.current = null;
      cur.reject(err);
    }
  }
}

// ── Single-session manager (LRU=1: the currently open project) ─────────────

let active: WslSession | null = null;

function distroName(): string {
  try {
    return loadSettings().wslDistro || 'Ubuntu';
  } catch {
    return 'Ubuntu';
  }
}

/** Returns the live session for this project, or null if none is open. */
export function getSession(projectPath: string): WslSession | null {
  if (active && active.projectPath === projectPath && !active.isDead()) return active;
  return null;
}

/**
 * Starts (or reuses) the persistent session for a project, closing the previous
 * one. Called when a project is opened so commit/push/status reuse it.
 */
export function prewarmSession(projectPath: string): WslSession {
  const existing = getSession(projectPath);
  if (existing) return existing;
  if (active) active.dispose();
  active = new WslSession(projectPath, distroName());
  return active;
}

/** Closes the active session (on app quit). */
export function closeAllSessions(): void {
  if (active) {
    active.dispose();
    active = null;
  }
}

/**
 * Runs git via the persistent session if one is open for this path, else
 * returns null so the caller can fall back to a one-shot `wsl ... git` spawn.
 */
export async function runViaSession(
  projectPath: string,
  args: string[],
  timeoutMs?: number,
): Promise<WslGitResult | null> {
  const session = getSession(projectPath);
  if (!session) return null;
  return session.run(args, timeoutMs);
}
