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

export interface Settings {
  workspacePath: string;
  plansPath: string;
  skillsPath: string;
  theme: 'system' | 'light' | 'dark';
}

/**
 * Returns TailwindCSS classes for a git branch badge.
 * 7 color variants — unified across ProjectItem and ProjectInfo.
 */
export function getBranchStyle(branch: string): string {
  if (branch === 'main' || branch === 'master') {
    return 'bg-[#0a1520] text-[#7b9ec4] border-[#7b9ec4]/30';
  }
  if (branch === 'develop') {
    return 'bg-[#0a1a18] text-[#5ba89c] border-[#5ba89c]/30';
  }
  if (branch === 'dev') {
    return 'bg-[#0a1a0e] text-[#6ba86b] border-[#6ba86b]/30';
  }
  if (branch.startsWith('feature/')) {
    return 'bg-[#140a20] text-[#9b7bc4] border-[#9b7bc4]/30';
  }
  if (branch.startsWith('hotfix/')) {
    return 'bg-[#1a0a0a] text-[#e05555] border-[#e05555]/30';
  }
  if (branch.startsWith('release/')) {
    return 'bg-[#2a1a0a] text-[#d4a44a] border-[#d4a44a]/30';
  }
  return 'bg-[#0f0f0f] text-[#8b5a3c] border-[#1f1a15]';
}

/** Truncates long branch names for display in badges. */
export function getBranchLabel(branch: string): string {
  return branch.length > 18 ? branch.slice(0, 17) + '…' : branch;
}
