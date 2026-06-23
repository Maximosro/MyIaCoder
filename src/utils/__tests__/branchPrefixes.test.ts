import { describe, it, expect } from 'vitest';
import { sanitizeBranchName } from '../branchPrefixes';

describe('sanitizeBranchName', () => {
  it('lowercases and dashes spaces', () => {
    expect(sanitizeBranchName('My New Feature')).toBe('my-new-feature');
  });

  it('drops invalid characters', () => {
    expect(sanitizeBranchName('fix: thing!')).toBe('fix-thing');
  });

  it('collapses repeats and trims edge separators', () => {
    expect(sanitizeBranchName('  a//b--c  ')).toBe('a/b-c');
    expect(sanitizeBranchName('-/.lead.trail/-')).toBe('lead.trail');
  });

  it('keeps allowed slashes for sub-scoping', () => {
    expect(sanitizeBranchName('ABC-123/improve stock')).toBe('abc-123/improve-stock');
  });
});
