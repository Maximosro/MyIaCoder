import { describe, it, expect, vi } from 'vitest';

// git.ts → settings.ts imports `electron`; stub it so the module loads in node.
vi.mock('electron', () => ({ app: { getPath: () => '' } }));

import { toWslPath } from '../git';

describe('toWslPath', () => {
  it('converts a Windows drive path to its /mnt mount, lowercasing the drive', () => {
    expect(toWslPath('C:\\ECLIPSE\\MyIaCoder')).toBe('/mnt/c/ECLIPSE/MyIaCoder');
  });

  it('handles non-C drives', () => {
    expect(toWslPath('D:\\repos\\app')).toBe('/mnt/d/repos/app');
  });

  it('leaves already-posix paths untouched', () => {
    expect(toWslPath('/mnt/c/already/posix')).toBe('/mnt/c/already/posix');
  });
});
