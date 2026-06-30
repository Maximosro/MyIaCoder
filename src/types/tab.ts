// ── Tab type system ──────────────────────────────────────────────

import type { SessionSource } from './session';

export type TabKind = 'terminal' | 'file' | 'diff' | 'session';

export type FileType = 'text' | 'json' | 'markdown' | 'yaml' | 'toml' | 'xml' | 'properties';

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
  /** When true, the editor starts in editable mode (unlocked) instead of read-only.
   *  Used for prompt files that should be edited immediately on open. */
  unlocked?: boolean;
  /** When true, this terminal tab runs the project's persisted run command (Play/Stop). */
  isRun?: boolean;
  // Session-transcript fields
  /** Agent-coder that produced the session (also drives accent color via `command`). */
  source?: SessionSource;
  /** On-disk id of the session whose transcript this tab shows. */
  sessionId?: string;
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

export function isSessionTab(tab: Tab): tab is Tab & { kind: 'session'; source: SessionSource; sessionId: string } {
  return tab.kind === 'session';
}
