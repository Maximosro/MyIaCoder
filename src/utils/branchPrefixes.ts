/**
 * Accepted branch prefixes (Inditex effimetrix "PR kinds").
 * Source: effimetrix.docs.inditex.dev > Features > Filtering > PR kind and labels.
 * Edit this list if the corporate convention changes.
 */
export const BRANCH_PREFIXES = [
  'feature/',
  'bugfix/',
  'hotfix/',
  'refactoring/',
  'improvement/',
  'internal/',
] as const;

export type BranchPrefix = (typeof BRANCH_PREFIXES)[number];

/**
 * Normalizes the user-typed part of a branch name to a git-safe slug:
 * lowercase, spaces→dashes, invalid chars dropped, collapsed/edge separators
 * trimmed. The backend still validates via git, this is just for a clean preview
 * and to avoid obviously invalid refs.
 */
export function sanitizeBranchName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._/-]+/g, '')
    .replace(/\/{2,}/g, '/')
    .replace(/-{2,}/g, '-')
    .replace(/^[-._/]+|[-._/]+$/g, '');
}
