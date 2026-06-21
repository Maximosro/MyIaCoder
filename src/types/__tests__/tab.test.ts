import { describe, it, expect } from 'vitest';
import {
  getFileType,
  getTabColorClass,
  getTabColorHex,
  SUPPORTED_EXTENSIONS,
} from '../../utils/tabUtils';
import { isFileTab, isTerminalTab } from '../tab';
import type { Tab } from '../tab';

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

  it('.yaml → yaml', () => {
    expect(getFileType('docker-compose.yaml')).toBe('yaml');
  });

  it('.toml → toml', () => {
    expect(getFileType('config.toml')).toBe('toml');
  });

  it('.TOML → toml (case insensitive)', () => {
    expect(getFileType('CONFIG.TOML')).toBe('toml');
  });

  it('.yml → yaml', () => {
    expect(getFileType('config.yml')).toBe('yaml');
  });

  it('.YML → yaml (case insensitive)', () => {
    expect(getFileType('CONFIG.YML')).toBe('yaml');
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
    expect(cls).toContain('text-[');
  });

  it('json returns blue classes', () => {
    const cls = getTabColorClass('json');
    expect(cls).toContain('#7b9ec4');
  });

  it('markdown returns copper classes', () => {
    const cls = getTabColorClass('markdown');
    expect(cls).toContain('e05555');
  });

  it('yaml returns amber classes', () => {
    const cls = getTabColorClass('yaml');
    expect(cls).toContain('#d4a44a');
    expect(cls).toContain('text-[');
  });

  it('toml returns teal classes', () => {
    const cls = getTabColorClass('toml');
    expect(cls).toContain('#4ab8b8');
    expect(cls).toContain('text-[');
  });
});

// ── getTabColorHex ────────────────────────────────────────────

describe('getTabColorHex', () => {
  it('text → #6ba86b', () => expect(getTabColorHex('text')).toBe('#6ba86b'));
  it('json → #7b9ec4', () => expect(getTabColorHex('json')).toBe('#7b9ec4'));
  it('markdown → #e05555', () => expect(getTabColorHex('markdown')).toBe('#e05555'));
  it('yaml → #d4a44a', () => expect(getTabColorHex('yaml')).toBe('#d4a44a'));
  it('toml → #4ab8b8', () => expect(getTabColorHex('toml')).toBe('#4ab8b8'));
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
  it('contains .txt, .json, .md, .yaml, .yml, .toml', () => {
    expect(SUPPORTED_EXTENSIONS.has('.txt')).toBe(true);
    expect(SUPPORTED_EXTENSIONS.has('.json')).toBe(true);
    expect(SUPPORTED_EXTENSIONS.has('.md')).toBe(true);
    expect(SUPPORTED_EXTENSIONS.has('.yaml')).toBe(true);
    expect(SUPPORTED_EXTENSIONS.has('.yml')).toBe(true);
    expect(SUPPORTED_EXTENSIONS.has('.toml')).toBe(true);
  });

  it('does not contain .ts', () => {
    expect(SUPPORTED_EXTENSIONS.has('.ts')).toBe(false);
  });
});

// ── Tab busy field ────────────────────────────────────────────

describe('Tab busy field', () => {
  it('accepts busy: true', () => {
    const tab: Tab = {
      id: '1',
      kind: 'terminal',
      projectName: 'test',
      projectPath: '/test',
      title: 'claude',
      command: 'claude',
      busy: true,
    };
    expect(tab.busy).toBe(true);
  });

  it('busy defaults to undefined when omitted', () => {
    const tab: Tab = {
      id: '1',
      kind: 'terminal',
      projectName: 'test',
      projectPath: '/test',
      title: 'bash',
    };
    expect(tab.busy).toBeUndefined();
  });
});
