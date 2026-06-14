import { execSync } from 'node:child_process';

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
