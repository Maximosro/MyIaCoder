import { existsSync, readdirSync, readFileSync, watch, type FSWatcher } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';

export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'blocked';
export type TaskSource = 'copilot' | 'claude';
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

const HOME = os.homedir();
const COPILOT_SESSIONS = path.join(HOME, '.copilot', 'session-state');

/** Normalise a path for comparison: drop trailing separators, unify slashes, lowercase (Windows). */
function normPath(p: string): string {
  return p.trim().replace(/[\\/]+$/, '').replace(/\\/g, '/').toLowerCase();
}

/** Minimal `key: value` reader for the flat workspace.yaml the Copilot CLI writes. */
function readYamlField(yaml: string, key: string): string | null {
  const m = yaml.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
  return m ? m[1].trim() : null;
}

/**
 * A Copilot session is "live" when it has an `inuse.<pid>.lock` whose PID is a
 * running process. Lock files are NOT removed on a hard close, so the PID check
 * is what distinguishes a running session from an orphaned one.
 */
function isSessionLive(sessionDir: string): boolean {
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

function toStatus(raw: string): TaskStatus {
  switch (raw) {
    case 'in_progress':
    case 'done':
    case 'blocked':
      return raw;
    default:
      return 'pending';
  }
}

/**
 * Reads the Copilot CLI task list for a project by scanning every session-state
 * folder, matching `workspace.yaml.cwd` to the project path, and reading the
 * `todos` + `todo_deps` tables from each session's SQLite store (read-only).
 */
function getCopilotTasks(projectPath: string): ProjectTasksResult {
  const target = normPath(projectPath);
  const sessions: TaskSession[] = [];

  if (!existsSync(COPILOT_SESSIONS)) {
    return { source: 'copilot', sessions };
  }

  let dirs: string[];
  try {
    dirs = readdirSync(COPILOT_SESSIONS, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch (err) {
    return { source: 'copilot', sessions, error: err instanceof Error ? err.message : 'Cannot read session-state' };
  }

  for (const dir of dirs) {
    const sessionDir = path.join(COPILOT_SESSIONS, dir);
    const yamlPath = path.join(sessionDir, 'workspace.yaml');
    const dbPath = path.join(sessionDir, 'session.db');
    if (!existsSync(yamlPath) || !existsSync(dbPath)) continue;

    let cwd: string | null;
    let name: string;
    let updatedAt: string;
    try {
      const yaml = readFileSync(yamlPath, 'utf-8');
      cwd = readYamlField(yaml, 'cwd');
      name = readYamlField(yaml, 'name') || dir;
      updatedAt = readYamlField(yaml, 'updated_at') || '';
    } catch {
      continue;
    }
    if (!cwd || normPath(cwd) !== target) continue;

    // Only live sessions are shown — when the CLI process exits, its tasks
    // disappear from the panel. No history is kept.
    if (!isSessionLive(sessionDir)) continue;

    try {
      const todos = readSessionTodos(dbPath);
      const subagents = readSessionSubagents(sessionDir);
      const tasks = [...todos, ...subagents];
      if (tasks.length > 0) {
        sessions.push({ sessionId: dir, name, updatedAt, live: true, tasks });
      }
    } catch {
      // Session store locked/corrupt — skip this session, keep the rest.
    }
  }

  // Most recently active session first.
  sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return { source: 'copilot', sessions };
}

/** Reads todos + dependencies from one session.db (read-only). */
function readSessionTodos(dbPath: string): Task[] {
  if (!existsSync(dbPath)) return [];
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  try {
    db.pragma('busy_timeout = 1000');
    const rows = db
      .prepare('SELECT id, title, description, status, created_at, updated_at FROM todos ORDER BY created_at')
      .all() as Array<{ id: string; title: string; description: string; status: string; created_at: string; updated_at: string }>;

    const deps = db.prepare('SELECT todo_id, depends_on FROM todo_deps').all() as Array<{ todo_id: string; depends_on: string }>;
    const depMap = new Map<string, string[]>();
    for (const d of deps) {
      const list = depMap.get(d.todo_id) ?? [];
      list.push(d.depends_on);
      depMap.set(d.todo_id, list);
    }

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description ?? '',
      status: toStatus(r.status),
      kind: 'todo' as const,
      createdAt: r.created_at ?? '',
      updatedAt: r.updated_at ?? '',
      dependsOn: depMap.get(r.id) ?? [],
    }));
  } finally {
    db.close();
  }
}

/**
 * Reads subagent tasks from a session's events.jsonl. These are the live
 * "tasks" the Copilot CLI tracks (`/tasks`) when the agent dispatches subagents
 * via the `task` tool — they never reach the todos table. A task is `done` once
 * a matching `subagent.completed` / `tool.execution_complete` event appears,
 * otherwise it is `in_progress`.
 */
function readSessionSubagents(sessionDir: string): Task[] {
  const eventsPath = path.join(sessionDir, 'events.jsonl');
  if (!existsSync(eventsPath)) return [];

  let raw: string;
  try {
    // ponytail: full read; events.jsonl is line-appended and tens-to-hundreds of KB.
    // If sessions ever grow to many MB, switch to a tail/streaming read.
    raw = readFileSync(eventsPath, 'utf-8');
  } catch {
    return [];
  }

  const starts = new Map<string, Task>();
  const completed = new Set<string>();

  for (const line of raw.split('\n')) {
    if (!line) continue;
    let e: {
      type?: string;
      timestamp?: string;
      data?: {
        toolCallId?: string;
        toolName?: string;
        arguments?: { name?: string; description?: string; agent_type?: string; mode?: string };
      };
    };
    try {
      e = JSON.parse(line);
    } catch {
      continue;
    }
    const id = e.data?.toolCallId;
    if (!id) continue;

    if (e.type === 'tool.execution_start' && e.data?.toolName === 'task') {
      const args = e.data.arguments ?? {};
      starts.set(id, {
        id,
        title: args.description || args.name || 'Subagent task',
        description: args.name ?? '',
        status: 'in_progress',
        kind: 'subagent',
        agentType: args.agent_type,
        mode: args.mode,
        createdAt: e.timestamp ?? '',
        updatedAt: e.timestamp ?? '',
        dependsOn: [],
      });
    } else if (e.type === 'subagent.completed' || e.type === 'tool.execution_complete') {
      completed.add(id);
      const t = starts.get(id);
      if (t) t.updatedAt = e.timestamp ?? t.updatedAt;
    }
  }

  for (const [id, task] of starts) {
    if (completed.has(id)) task.status = 'done';
  }

  return Array.from(starts.values());
}

/**
 * Returns the CLI task list for a project.
 * Copilot is read from `~/.copilot/session-state/*`. Claude is not wired yet —
 * it returns an empty result so the UI can show a "coming soon" state.
 */
export function getProjectTasks(projectPath: string, source: TaskSource): ProjectTasksResult {
  if (source === 'claude') {
    // ponytail: Claude todos (~/.claude/todos/*.json) not present on this setup; wire when used.
    return { source: 'claude', sessions: [] };
  }
  return getCopilotTasks(projectPath);
}

/**
 * Watches the Copilot session-state directory and invokes `onChange` (debounced)
 * whenever any session store changes, so the UI can refresh live.
 * Returns a disposer. Uses native fs.watch — no polling, no extra deps.
 */
export function watchTasks(onChange: () => void): () => void {
  if (!existsSync(COPILOT_SESSIONS)) return () => {};

  let timer: NodeJS.Timeout | null = null;
  const fire = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(onChange, 300);
  };

  let watcher: FSWatcher | null = null;
  try {
    watcher = watch(COPILOT_SESSIONS, { recursive: true }, fire);
  } catch {
    // Recursive watch unsupported — fall back to a non-recursive watch on the root.
    try {
      watcher = watch(COPILOT_SESSIONS, fire);
    } catch {
      return () => {};
    }
  }

  return () => {
    if (timer) clearTimeout(timer);
    watcher?.close();
  };
}
