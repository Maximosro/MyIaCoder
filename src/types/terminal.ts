// ── Tab type system ──────────────────────────────────────────────

export type TabKind = 'terminal' | 'file' | 'diff' | 'todo';

export type FileType = 'text' | 'json' | 'markdown' | 'yaml';

export interface Tab {
  id: string;
  kind: TabKind;
  projectName: string;
  projectPath: string;
  title: string;
  /** CLI command launched in this terminal tab (e.g. 'claude', 'copilot'). Used for accent coloring. */
  command?: string;
  // File-specific fields
  filePath?: string;
  fileType?: FileType;
  isDirty?: boolean;
  /** Whether the terminal tab is currently receiving output.
   *  Used for the activity indicator (breathing border) on Claude/Copilot tabs.
   *  Automatically cleared after 5 seconds of inactivity. */
  busy?: boolean;
  // Diff-specific fields
  diffContent?: string;
}

/** @deprecated Use Tab instead. Kept for backward compatibility. */
export type TerminalTab = Tab;

// ── Type guards ──────────────────────────────────────────────────

export function isFileTab(tab: Tab): tab is Tab & { kind: 'file'; filePath: string; fileType: FileType } {
  return tab.kind === 'file';
}

export function isTerminalTab(tab: Tab): tab is Tab & { kind: 'terminal' } {
  return tab.kind === 'terminal';
}

export function isTodoTab(tab: Tab): tab is Tab & { kind: 'todo' } {
  return tab.kind === 'todo';
}

export function isDiffTab(tab: Tab): tab is Tab & { kind: 'diff'; filePath: string; diffContent: string } {
  return tab.kind === 'diff';
}

// ── File type helpers ────────────────────────────────────────────

export const SUPPORTED_EXTENSIONS: ReadonlySet<string> = new Set(['.txt', '.json', '.md', '.yaml', '.yml']);

export function getFileType(fileName: string): FileType | null {
  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex === -1) return null;
  const ext = fileName.slice(dotIndex).toLowerCase();
  switch (ext) {
    case '.txt':
      return 'text';
    case '.json':
      return 'json';
    case '.md':
      return 'markdown';
    case '.yaml':
    case '.yml':
      return 'yaml';
    default:
      return null;
  }
}

/** Returns Tailwind border + text classes for the tab accent color. */
export function getTabColorClass(fileType: FileType): string {
  switch (fileType) {
    case 'text':
      return 'border-[#6ba86b] text-[#6ba86b]';
    case 'json':
      return 'border-[#7b9ec4] text-[#7b9ec4]';
    case 'markdown':
      return 'border-[#9b7bc4] text-[#9b7bc4]';
    case 'yaml':
      return 'border-[#d4a44a] text-[#d4a44a]';
  }
}

/** Returns a hex color string for the file type (used for icons, indicators). */
export function getTabColorHex(fileType: FileType): string {
  switch (fileType) {
    case 'text':
      return '#6ba86b';
    case 'json':
      return '#7b9ec4';
    case 'markdown':
      return '#d4784a';
    case 'yaml':
      return '#d4a44a';
  }
}
