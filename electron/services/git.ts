import { execSync, execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { readFileSync, existsSync, unlinkSync } from 'node:fs';

const execFileAsync = promisify(execFile);

/** Represents a single file change detected by git. */
export interface GitChange {
  status: 'M' | 'A' | 'D' | 'R' | '??' | 'MM' | 'AM' | 'RM';
  file: string;
  oldFile?: string;
}

/** Result of querying git for current branch changes. */
export interface GitChangesResult {
  branch: string;
  changes: GitChange[];
  error?: string;
}

/**
 * Returns the current branch name for a git repository.
 * Returns "unknown" if git is not available, the directory is not a repo,
 * or the command times out.
 */
export function getGitBranch(projectPath: string): string {
  try {
    const result = execSync(
      `git -C "${projectPath}" branch --show-current`,
      { encoding: 'utf-8', timeout: 5000, windowsHide: true },
    );
    return result.trim() || 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Async, non-blocking variant of getGitBranch.
 * Uses execFile so the main process event loop stays responsive while
 * branches load in the background. Returns "unknown" on any failure.
 */
export async function getGitBranchAsync(projectPath: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['-C', projectPath, 'branch', '--show-current'],
      { encoding: 'utf-8', timeout: 5000, windowsHide: true },
    );
    return stdout.trim() || 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Returns all files that have changed in the working tree compared to HEAD,
 * including staged, unstaged, and untracked files.
 *
 * Executes three git commands:
 * 1. `git diff --name-status HEAD`  → staged + committed changes vs HEAD
 * 2. `git diff --name-status`       → unstaged changes (working tree vs index)
 * 3. `git ls-files --others --exclude-standard` → untracked files
 *
 * Merges results deduplicating by file path, keeping the most significant status.
 * Returns an error field instead of throwing when git is unavailable.
 */
export function getGitChanges(projectPath: string): GitChangesResult {
  const branch = getGitBranch(projectPath);

  try {
    const changeMap = new Map<string, GitChange>();

    // Helper: parse lines of the form "<status>\t<file>" or "<status>\t<old>\t<new>"
    const ingest = (output: string, isUntracked?: boolean) => {
      for (const line of output.trim().split('\n')) {
        if (!line) continue;
        if (isUntracked) {
          const file = line.trim();
          if (file && !changeMap.has(file)) {
            changeMap.set(file, { status: '??', file });
          }
          continue;
        }
        // diff --name-status format: <status_char><optional_score>\t<file>[\t<new_file>]
        const tabIdx = line.indexOf('\t');
        if (tabIdx === -1) continue;
        const rawStatus = line.slice(0, tabIdx);
        // Strip rename similarity score (e.g. "R100" → "R")
        const status = rawStatus.charAt(0) as GitChange['status'];
        const rest = line.slice(tabIdx + 1);
        const parts = rest.split('\t');

        if (status === 'R' && parts.length >= 2) {
          const newFile = parts[1];
          if (!changeMap.has(newFile)) {
            changeMap.set(newFile, { status: 'R', file: newFile, oldFile: parts[0] });
          }
        } else {
          const file = parts[0];
          if (file && !changeMap.has(file)) {
            changeMap.set(file, { status: mapStatus(status), file });
          }
        }
      }
    };

    // 1. Staged + committed changes vs HEAD
    try {
      const staged = execSync(
        `git -C "${projectPath}" diff --name-status HEAD`,
        { encoding: 'utf-8', timeout: 10_000, windowsHide: true },
      );
      ingest(staged);
    } catch {
      // Possibly initial commit (no HEAD yet) — try --cached instead
      try {
        const cached = execSync(
          `git -C "${projectPath}" diff --name-status --cached`,
          { encoding: 'utf-8', timeout: 10_000, windowsHide: true },
        );
        ingest(cached);
      } catch {
        // Repo exists but git commands fail — continue with remaining checks
      }
    }

    // 2. Unstaged changes (working tree vs index)
    try {
      const unstaged = execSync(
        `git -C "${projectPath}" diff --name-status`,
        { encoding: 'utf-8', timeout: 10_000, windowsHide: true },
      );
      ingest(unstaged);
    } catch {
      // Non-fatal — continue
    }

    // 3. Untracked files
    try {
      const untracked = execSync(
        `git -C "${projectPath}" ls-files --others --exclude-standard`,
        { encoding: 'utf-8', timeout: 10_000, windowsHide: true },
      );
      ingest(untracked, true);
    } catch {
      // Non-fatal — continue
    }

    return {
      branch,
      changes: Array.from(changeMap.values()),
    };
  } catch (err) {
    return {
      branch,
      changes: [],
      error: err instanceof Error ? err.message : 'Git command failed',
    };
  }
}

/** Normalise raw status characters to our canonical set. */
function mapStatus(raw: string): GitChange['status'] {
  const s = raw.charAt(0).toUpperCase();
  if (s === 'M') return 'M';
  if (s === 'A') return 'A';
  if (s === 'D') return 'D';
  if (s === 'R') return 'R';
  return 'M'; // fallback — treat any other status as modified
}

/** Result of fetching both sides of a file for diff display. */
export interface GitFileVersions {
  original: string | null;   // null when file is new (untracked / added)
  modified: string | null;   // null when file is deleted
}

/**
 * Returns the original (HEAD / staged) and modified (working tree) versions
 * of a file for side-by-side diff display.
 *
 * - original: `git show HEAD:<path>` (falls back to empty for new files)
 * - modified: reads the file from disk (null for deleted files)
 */
export function getGitFileVersions(projectPath: string, relativePath: string): GitFileVersions {
  let original: string | null = null;
  let modified: string | null = null;

  // Original: try git show HEAD:path
  try {
    original = execSync(
      `git -C "${projectPath}" show HEAD:"${relativePath}"`,
      { encoding: 'utf-8', timeout: 10_000, windowsHide: true },
    );
  } catch {
    // File is new (not in HEAD) — original stays null
    original = null;
  }

  // Modified: read from working tree
  try {
    const absPath = path.join(projectPath, relativePath);
    modified = readFileSync(absPath, 'utf-8');
  } catch {
    // File is deleted — modified stays null
    modified = null;
  }

  return { original, modified };
}

/**
 * Returns the unified diff for a specific file in the working tree.
 *
 * Tries in order:
 * 1. `git diff HEAD -- <file>`   → staged + committed changes vs HEAD
 * 2. `git diff -- <file>`        → unstaged changes (working tree vs index)
 * 3. `git diff --cached -- <file>` → staged changes (no HEAD fallback)
 * 4. Reads the file directly and synthesises a diff showing all lines as
 *    additions (covers untracked / new files). Avoids /dev/null which
 *    does not exist on Windows.
 *
 * Returns the raw diff output or a synthesised diff for untracked files.
 * Never throws — returns an error message string on total failure.
 */
export function getGitDiff(projectPath: string, filePath: string): string {
  // 1. Staged + committed vs HEAD
  try {
    const result = execSync(
      `git -C "${projectPath}" diff HEAD -- "${filePath}"`,
      { encoding: 'utf-8', timeout: 10_000, windowsHide: true },
    );
    if (result.trim()) return result;
  } catch {
    // HEAD may not exist — continue
  }

  // 2. Unstaged (working tree vs index)
  try {
    const result = execSync(
      `git -C "${projectPath}" diff -- "${filePath}"`,
      { encoding: 'utf-8', timeout: 10_000, windowsHide: true },
    );
    if (result.trim()) return result;
  } catch {
    // Non-fatal
  }

  // 3. Staged only (no HEAD, e.g. initial commit)
  try {
    const result = execSync(
      `git -C "${projectPath}" diff --cached -- "${filePath}"`,
      { encoding: 'utf-8', timeout: 10_000, windowsHide: true },
    );
    if (result.trim()) return result;
  } catch {
    // Non-fatal
  }

  // 4. Untracked / new file — synthesise diff by reading file directly
  try {
    const absPath = path.join(projectPath, filePath);
    const content = readFileSync(absPath, 'utf-8');
    const lines = content.split('\n');
    const hasTrailingNewline = content.endsWith('\n');

    const header =
      `diff --git a/${filePath} b/${filePath}\n` +
      `new file mode 100644\n` +
      `index 0000000..0000000\n` +
      `--- /dev/null\n` +
      `+++ b/${filePath}\n`;

    const body = lines.map((line, i) => {
      // Don't add + to empty string after final newline split
      if (i === lines.length - 1 && line === '' && hasTrailingNewline) {
        return '';
      }
      return `+${line}`;
    }).filter((l) => l !== '' || hasTrailingNewline).join('\n');

    const noNewline = hasTrailingNewline ? '' : '\n\\ No newline at end of file';
    return header + body + noNewline;
  } catch {
    return `# Unable to generate diff for: ${filePath}\n# The file may be binary or inaccessible.`;
  }
}

/** Result of a git remote operation (push / pull / fetch). */
export interface GitRemoteResult {
  ok: boolean;
  output?: string;
  error?: string;
}

/** How many commits the local branch is ahead/behind its upstream. */
export interface GitAheadBehind {
  ahead: number;
  behind: number;
}

const REMOTE_TIMEOUT = 30_000;

/** Runs `git fetch` for the given repository. */
export async function gitFetch(projectPath: string): Promise<GitRemoteResult> {
  try {
    const { stdout, stderr } = await execFileAsync(
      'git', ['-C', projectPath, 'fetch'],
      { encoding: 'utf-8', timeout: REMOTE_TIMEOUT, windowsHide: true },
    );
    return { ok: true, output: (stdout + stderr).trim() || undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Fetch failed' };
  }
}

/** Runs `git pull origin <current-branch>` for the given repository. */
export async function gitPull(projectPath: string): Promise<GitRemoteResult> {
  try {
    // Get current branch name for explicit pull
    const { stdout: branchName } = await execFileAsync(
      'git', ['-C', projectPath, 'branch', '--show-current'],
      { encoding: 'utf-8', timeout: 5000, windowsHide: true },
    );
    const branch = branchName.trim();
    const args = branch
      ? ['-C', projectPath, 'pull', 'origin', branch]
      : ['-C', projectPath, 'pull'];
    const { stdout, stderr } = await execFileAsync(
      'git', args,
      { encoding: 'utf-8', timeout: REMOTE_TIMEOUT, windowsHide: true },
    );
    return { ok: true, output: (stdout + stderr).trim() || undefined };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Pull failed';
    return { ok: false, error: msg };
  }
}

/** Runs `git push` for the given repository. Uses `origin HEAD` explicitly and sets upstream if needed. */
export async function gitPush(projectPath: string): Promise<GitRemoteResult> {
  try {
    const { stdout, stderr } = await execFileAsync(
      'git', ['-C', projectPath, 'push', '--set-upstream', 'origin', 'HEAD'],
      { encoding: 'utf-8', timeout: REMOTE_TIMEOUT, windowsHide: true },
    );
    return { ok: true, output: (stdout + stderr).trim() || undefined };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Push failed';
    return { ok: false, error: msg };
  }
}

/**
 * Returns how many commits the current branch is ahead/behind its upstream.
 * Returns {0,0} when there is no upstream configured.
 */
export async function gitAheadBehind(projectPath: string): Promise<GitAheadBehind> {
  try {
    const { stdout } = await execFileAsync(
      'git', ['-C', projectPath, 'rev-list', '--left-right', '--count', 'HEAD...@{upstream}'],
      { encoding: 'utf-8', timeout: 5000, windowsHide: true },
    );
    const [ahead, behind] = stdout.trim().split(/\s+/).map(Number);
    return { ahead: ahead || 0, behind: behind || 0 };
  } catch {
    // No upstream or git error — treat as 0/0
    return { ahead: 0, behind: 0 };
  }
}

/** Stages all changes and commits with the given message. */
export async function gitCommit(projectPath: string, message: string): Promise<GitRemoteResult> {
  try {
    await execFileAsync(
      'git', ['-C', projectPath, 'add', '-A'],
      { encoding: 'utf-8', timeout: REMOTE_TIMEOUT, windowsHide: true },
    );
    const { stdout, stderr } = await execFileAsync(
      'git', ['-C', projectPath, 'commit', '-m', message],
      { encoding: 'utf-8', timeout: REMOTE_TIMEOUT, windowsHide: true },
    );
    return { ok: true, output: (stdout + stderr).trim() || undefined };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Commit failed';
    return { ok: false, error: msg };
  }
}

/** Result of a discard operation. */
export interface DiscardResult {
  ok: boolean;
  error?: string;
}

/**
 * Discards working-tree changes for a single file, reverting it like
 * GitHub Desktop's "Discard changes":
 *  - Files that exist in HEAD (modified, deleted, staged) are restored with
 *    `git checkout HEAD -- <file>` (reverts both index and working tree).
 *  - New files (untracked or staged-added, absent from HEAD) are unstaged and
 *    deleted from disk.
 *
 * This is destructive and cannot be undone. Never throws — returns ok/error.
 */
export function discardFileChanges(projectPath: string, filePath: string): DiscardResult {
  // Guard against path traversal — the resolved file must stay inside the repo.
  const absPath = path.resolve(projectPath, filePath);
  if (absPath !== path.resolve(projectPath) && !absPath.startsWith(path.resolve(projectPath) + path.sep)) {
    return { ok: false, error: 'Path is outside the project' };
  }

  // git tracks paths with forward slashes.
  const gitPath = filePath.replace(/\\/g, '/');

  const inHead = (() => {
    try {
      execFileSync('git', ['-C', projectPath, 'cat-file', '-e', `HEAD:${gitPath}`], {
        timeout: 10_000,
        windowsHide: true,
        stdio: 'ignore',
      });
      return true;
    } catch {
      return false;
    }
  })();

  try {
    if (inHead) {
      execFileSync('git', ['-C', projectPath, 'checkout', 'HEAD', '--', gitPath], {
        timeout: 10_000,
        windowsHide: true,
      });
    } else {
      // New file: drop it from the index if staged (ignore failure if it isn't)…
      try {
        execFileSync('git', ['-C', projectPath, 'rm', '-f', '--cached', '--', gitPath], {
          timeout: 10_000,
          windowsHide: true,
          stdio: 'ignore',
        });
      } catch {
        // Not staged — fine.
      }
      // …then remove it from disk.
      if (existsSync(absPath)) unlinkSync(absPath);
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Discard failed' };
  }
}
