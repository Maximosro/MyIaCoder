// ── Tab type system ──────────────────────────────────────────────

export type TabKind = 'terminal' | 'file' | 'diff';

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

// ── Type guards ──────────────────────────────────────────────────

export function isFileTab(tab: Tab): tab is Tab & { kind: 'file'; filePath: string; fileType: FileType } {
  return tab.kind === 'file';
}

export function isTerminalTab(tab: Tab): tab is Tab & { kind: 'terminal' } {
  return tab.kind === 'terminal';
}

export function isDiffTab(tab: Tab): tab is Tab & { kind: 'diff'; filePath: string; diffContent: string } {
  return tab.kind === 'diff';
}
