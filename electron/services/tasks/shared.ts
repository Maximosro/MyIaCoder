import os from 'node:os';
import path from 'node:path';
import { readdirSync } from 'node:fs';

// ponytail: dynamic import — better-sqlite3 is native and may fail to install.
// Only Copilot needs it; the rest of the app must not crash without it.
type DatabaseCtor = new (...args: any[]) => { close(): void; pragma(s: string): void; prepare(s: string): { all(): unknown[]; get(): unknown } };
let Database: DatabaseCtor | null = null;
let dbImportFailed = false;

export function getDatabase(): DatabaseCtor | null {
  if (dbImportFailed) return null;
  if (Database) return Database;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Database = require('better-sqlite3') as DatabaseCtor;
    return Database;
  } catch {
    dbImportFailed = true;
    return null;
  }
}

export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'blocked';
export type TaskSource = 'copilot' | 'claude' | 'reasonix';
export type TaskKind = 'todo' | 'subagent';

/** A single task extracted from a CLI session store (todo list or subagent run). */
export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  kind: TaskKind;
  /** Subagent type (e.g. 'research', 'general-purpose'). Undefined for todos. */
  agentType?: string;
  /** Subagent run mode ('sync' | 'background'). Undefined for todos. */
  mode?: string;
  /** Model used by the subagent (e.g. 'deepseek-v4-flash', 'claude-opus-4-8'). */
  model?: string;
  createdAt: string;
  updatedAt: string;
  dependsOn: string[];
}

/** All tasks belonging to one CLI session, scoped to a project. */
export interface TaskSession {
  sessionId: string;
  name: string;
  updatedAt: string;
  /** True when the session's CLI process is still running (live lock + alive PID). */
  live: boolean;
  tasks: Task[];
}

/** Result of querying CLI task stores for a project. */
export interface ProjectTasksResult {
  source: TaskSource;
  sessions: TaskSession[];
  error?: string;
}

export const HOME = os.homedir();
export const COPILOT_SESSIONS = path.join(HOME, '.copilot', 'session-state');
export const CLAUDE_SESSIONS = path.join(HOME, '.claude', 'sessions');
export const CLAUDE_PROJECTS = path.join(HOME, '.claude', 'projects');

/** Converts a project path to the slug Claude Code uses for its project directory.
 *  C:\Workspace\MyIaCoder → C--Workspace-MyIaCoder
 *  Sanitises path separators and parent references to prevent traversal. */
export function projectPathToSlug(p: string): string {
  return p.replace(/[:\\/]/g, '-').replace(/\.\./g, '');
}

/** Normalise a path for comparison: drop trailing separators, unify slashes, lowercase (Windows). */
export function normPath(p: string): string {
  return p.trim().replace(/[\\/]+$/, '').replace(/\\/g, '/').toLowerCase();
}

/** Minimal `key: value` reader for the flat workspace.yaml the Copilot CLI writes. */
export function readYamlField(yaml: string, key: string): string | null {
  const m = yaml.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
  return m ? m[1].trim() : null;
}

/**
 * A Copilot session is "live" when it has an `inuse.<pid>.lock` whose PID is a
 * running process. Lock files are NOT removed on a hard close, so the PID check
 * is what distinguishes a running session from an orphaned one.
 */
export function isSessionLive(sessionDir: string): boolean {
  let files: string[];
  try {
    files = readdirSync(sessionDir);
  } catch {
    return false;
  }
  for (const f of files) {
    const m = f.match(/^inuse\.(\d+)\.lock$/);
    if (!m) continue;
    const pid = Number(m[1]);
    try {
      // Signal 0 throws ESRCH if the process does not exist; succeeds if alive.
      process.kill(pid, 0);
      return true;
    } catch {
      // Stale lock — process is gone.
    }
  }
  return false;
}

export function toStatus(raw: string): TaskStatus {
  switch (raw) {
    case 'in_progress':
    case 'done':
    case 'blocked':
      return raw;
    default:
      return 'pending';
  }
}
