export interface Project {
  name: string;
  path: string;
  branch: string;
}

export interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: TreeNode[];
}

/** TreeNode carrying the git status of a changed file (used by GitChangesTree). */
export interface GitTreeNode extends TreeNode {
  gitStatus?: GitChange['status'];
  children?: GitTreeNode[];
}

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

export interface Settings {
  workspacePath: string;
  plansPath: string;
  skillsPath: string;
  promptsPath: string;
  theme: 'system' | 'light' | 'dark';
}

