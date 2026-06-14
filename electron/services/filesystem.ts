import { readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { getGitBranch } from './git';

export interface Project {
  name: string;
  path: string;
  branch: string;
}

/**
 * Scans the workspace directory for git projects (folders containing .git).
 * Returns an array of projects with their current git branch.
 * Returns empty array if workspacePath does not exist.
 */
export async function scanWorkspace(workspacePath: string): Promise<Project[]> {
  try {
    const entries = readdirSync(workspacePath, { withFileTypes: true });
    const directories = entries.filter((d) => d.isDirectory());

    const projects = await Promise.all(
      directories.map(async (dirent) => {
        const fullPath = path.join(workspacePath, dirent.name);
        const hasGit = existsSync(path.join(fullPath, '.git'));
        if (!hasGit) return null;

        const branch = getGitBranch(fullPath);
        return {
          name: dirent.name,
          path: fullPath,
          branch,
        } as Project;
      }),
    );

    return projects.filter((p): p is Project => p !== null);
  } catch {
    // Workspace path doesn't exist or is inaccessible
    return [];
  }
}
