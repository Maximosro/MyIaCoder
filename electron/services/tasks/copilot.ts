import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  getDatabase,
  COPILOT_SESSIONS,
  normPath,
  readYamlField,
  isSessionLive,
  toStatus,
  type Task,
  type TaskSession,
  type ProjectTasksResult,
} from './shared';

/** Set of session IDs (tab UUIDs) for Copilot terminals launched from this app.
 *  Copilot sessions are launched with `--session-id=<tabId>`, so the session-state
 *  folder name equals the tab UUID. Only these sessions are shown — external
 *  Copilot instances (e.g. a CLI run by hand in the same project) are hidden. */
const activeCopilotSessionIds = new Set<string>();

/** Register a Copilot session as "ours" so its tasks appear in the panel. */
export function registerCopilotSession(sessionId: string): void {
  activeCopilotSessionIds.add(sessionId);
}

/** Unregister a Copilot session when its terminal tab is closed. */
export function unregisterCopilotSession(sessionId: string): void {
  activeCopilotSessionIds.delete(sessionId);
}

/**
 * Reads the Copilot CLI task list for a project by scanning every session-state
 * folder, matching `workspace.yaml.cwd` to the project path, and reading the
 * `todos` + `todo_deps` tables from each session's SQLite store (read-only).
 */
export function getCopilotTasks(projectPath: string): ProjectTasksResult {
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
    // Only show Copilot sessions launched from this app (folder name == tab UUID).
    if (!activeCopilotSessionIds.has(dir)) continue;

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
  const DB = getDatabase();
  if (!DB) return [];
  const db = new DB(dbPath, { readonly: true, fileMustExist: true });
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
 * via the `task` tool — they never reach the todos table.
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

  return parseCopilotEvents(raw);
}

/** Exported for tests: parse Copilot CLI events.jsonl into sidebar subagent tasks. */
export function parseCopilotEvents(raw: string): Task[] {
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
        success?: boolean;
        error?: { message?: string };
        agentName?: string;
        model?: string;
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
    } else if (e.type === 'subagent.completed') {
      completed.add(id);
      const t = starts.get(id);
      if (t) {
        t.agentType ??= e.data?.agentName;
        t.model ??= e.data?.model;
        t.updatedAt = e.timestamp ?? t.updatedAt;
      }
    } else if (e.type === 'subagent.failed') {
      const t = starts.get(id);
      if (t) {
        t.status = 'blocked';
        t.updatedAt = e.timestamp ?? t.updatedAt;
        const message = e.data?.error?.message;
        if (message) t.description = t.description ? `${t.description} (${message})` : message;
      }
    } else if (e.type === 'tool.execution_complete') {
      // ponytail: tool.execution_complete fires immediately for background tasks
      // (dispatch returns agent_id); only mark done for sync tasks.
      const t = starts.get(id);
      if (t) {
        t.updatedAt = e.timestamp ?? t.updatedAt;
        if (e.data?.success === false) {
          t.status = 'blocked';
          const message = e.data.error?.message;
          if (message) t.description = t.description ? `${t.description} (${message})` : message;
        } else if (t.mode !== 'background') {
          completed.add(id);
        }
      }
    }
  }

  for (const [id, task] of starts) {
    if (completed.has(id) && task.status !== 'blocked') task.status = 'done';
  }

  return Array.from(starts.values());
}
