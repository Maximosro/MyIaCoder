import { execSync } from 'node:child_process';
import path from 'node:path';
import { readFileSync } from 'node:fs';

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
