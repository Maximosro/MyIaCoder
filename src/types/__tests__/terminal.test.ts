import { describe, it, expect } from 'vitest';
import {
  getFileType,
  getTabColorClass,
  getTabColorHex,
  isFileTab,
  isTerminalTab,
  SUPPORTED_EXTENSIONS,
} from '../terminal';
import type { Tab } from '../terminal';

// ── getFileType ───────────────────────────────────────────────

describe('getFileType', () => {
  it('.txt → text', () => {
    expect(getFileType('readme.txt')).toBe('text');
  });

  it('.TXT → text (case insensitive)', () => {
    expect(getFileType('README.TXT')).toBe('text');
  });

  it('.json → json', () => {
    expect(getFileType('config.json')).toBe('json');
  });

  it('.JSON → json (case insensitive)', () => {
    expect(getFileType('PACKAGE.JSON')).toBe('json');
  });

  it('.md → markdown', () => {
    expect(getFileType('README.md')).toBe('markdown');
  });

  it('.MD → markdown (case insensitive)', () => {
    expect(getFileType('CHANGELOG.MD')).toBe('markdown');
  });

  it('.ts → null (unsupported)', () => {
    expect(getFileType('main.ts')).toBeNull();
  });

  it('no extension → null', () => {
    expect(getFileType('Makefile')).toBeNull();
  });

  it('hidden file with supported ext → works', () => {
    expect(getFileType('.config.json')).toBe('json');
  });
});

// ── getTabColorClass ──────────────────────────────────────────

describe('getTabColorClass', () => {
  it('text returns green classes', () => {
    const cls = getTabColorClass('text');
    expect(cls).toContain('#6ba86b');
    expect(cls).toContain('border');
  });

  it('json returns blue classes', () => {
    const cls = getTabColorClass('json');
    expect(cls).toContain('#7b9ec4');
  });

  it('markdown returns copper classes', () => {
    const cls = getTabColorClass('markdown');
    expect(cls).toContain('9b7bc4');
  });
});

// ── getTabColorHex ────────────────────────────────────────────

describe('getTabColorHex', () => {
  it('text → #6ba86b', () => expect(getTabColorHex('text')).toBe('#6ba86b'));
  it('json → #7b9ec4', () => expect(getTabColorHex('json')).toBe('#7b9ec4'));
  it('markdown → #d4784a', () => expect(getTabColorHex('markdown')).toBe('#d4784a'));
});

// ── Type guards ───────────────────────────────────────────────

describe('isFileTab', () => {
  it('file tab returns true', () => {
    const tab: Tab = {
      id: '1',
      kind: 'file',
      projectName: 'test',
      projectPath: '/test',
      title: 'readme.md',
      filePath: '/test/readme.md',
      fileType: 'markdown',
    };
    expect(isFileTab(tab)).toBe(true);
    if (isFileTab(tab)) {
      // Narrowed type check
      expect(tab.fileType).toBe('markdown');
    }
  });

  it('terminal tab returns false', () => {
    const tab: Tab = {
      id: '2',
      kind: 'terminal',
      projectName: 'test',
      projectPath: '/test',
      title: 'bash',
    };
    expect(isFileTab(tab)).toBe(false);
  });
});

describe('isTerminalTab', () => {
  it('terminal tab returns true', () => {
    const tab: Tab = {
      id: '1',
      kind: 'terminal',
      projectName: 'test',
      projectPath: '/test',
      title: 'bash',
    };
    expect(isTerminalTab(tab)).toBe(true);
  });

  it('file tab returns false', () => {
    const tab: Tab = {
      id: '1',
      kind: 'file',
      projectName: 'test',
      projectPath: '/test',
      title: 'readme.md',
      filePath: '/test/readme.md',
      fileType: 'markdown',
    };
    expect(isTerminalTab(tab)).toBe(false);
  });
});

// ── SUPPORTED_EXTENSIONS ──────────────────────────────────────

describe('SUPPORTED_EXTENSIONS', () => {
  it('contains .txt, .json, .md', () => {
    expect(SUPPORTED_EXTENSIONS.has('.txt')).toBe(true);
    expect(SUPPORTED_EXTENSIONS.has('.json')).toBe(true);
    expect(SUPPORTED_EXTENSIONS.has('.md')).toBe(true);
  });

  it('does not contain .ts', () => {
    expect(SUPPORTED_EXTENSIONS.has('.ts')).toBe(false);
  });
});
