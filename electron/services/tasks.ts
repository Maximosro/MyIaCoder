import { existsSync, readdirSync, readFileSync, statSync, watch, type FSWatcher } from 'node:fs';
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

const HOME = os.homedir();
const COPILOT_SESSIONS = path.join(HOME, '.copilot', 'session-state');
const CLAUDE_SESSIONS = path.join(HOME, '.claude', 'sessions');
const CLAUDE_PROJECTS = path.join(HOME, '.claude', 'projects');

/** Set of session IDs (tab UUIDs) for Claude terminals launched from this app.
 *  Only sessions whose sessionId is in this set are shown — external Claude
 *  instances (other terminals, other apps) are invisible to the panel. */
const activeClaudeSessionIds = new Set<string>();

/** Register a Claude session as "ours" so its subagents appear in the panel. */
export function registerClaudeSession(sessionId: string): void {
  activeClaudeSessionIds.add(sessionId);
}

/** Unregister a Claude session when its terminal tab is closed. */
export function unregisterClaudeSession(sessionId: string): void {
  activeClaudeSessionIds.delete(sessionId);
}

/** Converts a project path to the slug Claude Code uses for its project directory.
 *  C:\Workspace\MyIaCoder → C--Workspace-MyIaCoder
 *  Sanitises path separators and parent references to prevent traversal. */
function projectPathToSlug(p: string): string {
  return p.replace(/[:\\/]/g, '-').replace(/\.\./g, '');
}

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
 * Reads subagent tasks from a Claude Code project transcript JSONL.
 * Agent tool_use events signal subagent start; matching tool_result events
 * signal completion. Only subagent tasks are extracted — todos are not
 * persisted to disk by Claude Code in a machine-readable format.
 */
function readClaudeSessionSubagents(sessionId: string, projectSlug: string): Task[] {
  const transcriptPath = path.join(CLAUDE_PROJECTS, projectSlug, `${sessionId}.jsonl`);
  if (!existsSync(transcriptPath)) return [];

  let raw: string;
  try {
    raw = readFileSync(transcriptPath, 'utf-8');
  } catch {
    return [];
  }

  const starts = new Map<string, Task>();
  const completed = new Set<string>();

  // ── Pass 1: background agent completion via subagents/ directory ──
  // Claude Code writes each background agent's transcript to
  //   ~/.claude/projects/<slug>/<sessionId>/subagents/agent-<id>.jsonl
  // and a .meta.json with the toolUseId → agentId mapping.
  // Completion is detected by agent JSONL mtime (idle > 10s = done).
  const subagentsDir = path.join(CLAUDE_PROJECTS, projectSlug, sessionId, 'subagents');
  const agentCompletion = new Map<string, boolean>(); // toolUseId → completed
  const agentModel = new Map<string, string>(); // toolUseId → model name
  if (existsSync(subagentsDir)) {
    try {
      const entries = readdirSync(subagentsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith('.meta.json')) continue;
        let meta: { toolUseId?: string };
        try {
          meta = JSON.parse(readFileSync(path.join(subagentsDir, entry.name), 'utf-8'));
        } catch { continue; }
        if (!meta.toolUseId) continue;

        const agentId = entry.name.replace(/\.meta\.json$/, '');
        const agentJsonl = path.join(subagentsDir, `${agentId}.jsonl`);
        if (!existsSync(agentJsonl)) continue;

        // An agent is considered done when its JSONL hasn't been written to
        // for over 10 seconds — Claude Code appends to it while the agent runs.
        let completedFlag = false;
        try {
          const stat = statSync(agentJsonl);
          const idle = Date.now() - stat.mtimeMs;
          completedFlag = idle > 10_000;
        } catch { /* keep false */ }
        // Also try to read the model from the first assistant message.
        let model = null;
        try {
          const agentRaw = readFileSync(agentJsonl, 'utf-8');
          const m = agentRaw.match(/"model":"([^"]+)"/);
          if (m) model = m[1];
        } catch { /* keep null */ }
        if (model) agentModel.set(meta.toolUseId, model);

        agentCompletion.set(meta.toolUseId, completedFlag);
      }
    } catch { /* subagents dir unreadable — skip */ }
  }

  // ── Pass 2: parse the main transcript JSONL ──

  // Fast-path: skip lines that cannot possibly contain Agent or tool_result events.
  // This avoids expensive JSON.parse on 95%+ of lines in large transcripts (1+ MB).
  for (const line of raw.split('\n')) {
    if (!line) continue;
    if (!line.includes('"Agent"') && !line.includes('"tool_result"')) continue;

    let e: {
      type?: string;
      timestamp?: string;
      message?: {
        role?: string;
        content?: Array<{
          type?: string;
          id?: string;
          name?: string;
          input?: { description?: string; subagent_type?: string; model?: string; run_in_background?: boolean };
          tool_use_id?: string;
          is_error?: boolean;
        }>;
      };
    };
    try { e = JSON.parse(line); } catch { continue; }

    const content = e.message?.content;
    if (!content || !Array.isArray(content) || content.length === 0) continue;

    // Subagent start: assistant message with Agent tool_use
    if (e.type === 'assistant' && e.message?.role === 'assistant') {
      const toolUse = content.find((c) => c.type === 'tool_use' && c.name === 'Agent');
      if (toolUse?.id) {
        const input = toolUse.input ?? {};
        const isBackground = !!input.run_in_background;
        starts.set(toolUse.id, {
          id: toolUse.id,
          title: input.description || 'Subagent',
          description: input.description ?? '',
          status: 'in_progress',
          kind: 'subagent',
          agentType: input.subagent_type,
          mode: isBackground ? 'background' : 'sync',
          model: input.model,
          createdAt: e.timestamp ?? '',
          updatedAt: e.timestamp ?? '',
          dependsOn: [],
        });
      }
    }

    // Subagent completion: user message with tool_result matching a tool_use id.
    // Background agents receive an immediate acknowledgement tool_result that
    // must NOT be treated as completion — only sync agents complete this way.
    if (e.type === 'user' && e.message?.role === 'user') {
      for (const c of content) {
        if (c.type === 'tool_result' && c.tool_use_id && starts.has(c.tool_use_id)) {
          const t = starts.get(c.tool_use_id);
          if (t) {
            t.updatedAt = e.timestamp ?? t.updatedAt;
            if (c.is_error) {
              t.status = 'blocked';
              t.description = `${t.description} (error)`;
            } else if (t.mode !== 'background') {
              // Only sync agents complete via tool_result.
              completed.add(c.tool_use_id);
            }
            // Background agents stay in_progress until the session dies.
          }
        }
      }
    }
  }

  for (const [id, task] of starts) {
    // Fill in model from subagent JSONL if not explicitly set in the input.
    if (!task.model) task.model = agentModel.get(id);

    if (task.status === 'blocked') continue;
    if (task.mode === 'background') {
      // Background agents complete when their subagent transcript ends.
      const done = agentCompletion.get(id);
      if (done === true) task.status = 'done';
      // If done === false or missing, stays in_progress.
    } else if (completed.has(id)) {
      // Sync agents complete via tool_result in the main transcript.
      task.status = 'done';
    }
  }

  return Array.from(starts.values());
}

/**
 * Scans ~/.claude/sessions/*.json for live Claude Code sessions whose cwd
 * matches the project path, then reads subagent tasks from the corresponding
 * project transcript JSONL.  Only sessions whose PID is still alive are
 * returned — when the CLI exits, tasks disappear (same behaviour as Copilot).
 */
function getClaudeTasks(projectPath: string): ProjectTasksResult {
  const target = normPath(projectPath);
  const sessions: TaskSession[] = [];

  if (!existsSync(CLAUDE_SESSIONS)) {
    return { source: 'claude', sessions };
  }

  let files: string[];
  try {
    files = readdirSync(CLAUDE_SESSIONS, { withFileTypes: true })
      .filter((d) => d.isFile() && d.name.endsWith('.json'))
      .map((d) => d.name);
  } catch {
    return { source: 'claude', sessions, error: 'Cannot read Claude sessions directory' };
  }

  for (const file of files) {
    const sessionFile = path.join(CLAUDE_SESSIONS, file);
    let data: { pid?: number; sessionId?: string; cwd?: string; name?: string; updatedAt?: number };
    try {
      data = JSON.parse(readFileSync(sessionFile, 'utf-8'));
    } catch {
      continue;
    }
    if (!data.cwd || !data.sessionId || data.pid == null) continue;
    if (normPath(data.cwd) !== target) continue;

    // Only show sessions launched from this app (matching a tab UUID).
    if (!activeClaudeSessionIds.has(data.sessionId)) continue;

    // Liveness check: signal 0 throws ESRCH if the PID is gone.
    let live = false;
    try {
      process.kill(data.pid, 0);
      live = true;
    } catch {
      continue;
    }

    const projectSlug = projectPathToSlug(projectPath);
    const subagents = readClaudeSessionSubagents(data.sessionId, projectSlug);
    const name = data.name || file.replace(/\.json$/, '');
    const updatedAt = data.updatedAt ? new Date(data.updatedAt).toISOString() : '';

    if (subagents.length > 0) {
      sessions.push({ sessionId: data.sessionId, name, updatedAt, live, tasks: subagents });
    }
  }

  sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return { source: 'claude', sessions };
}

/**
 * Copilot is read from `~/.copilot/session-state/*`. Claude is not wired yet —
 * it returns an empty result so the UI can show a "coming soon" state.
 */
export function getProjectTasks(projectPath: string, source: TaskSource): ProjectTasksResult {
  if (source === 'claude') {
    return getClaudeTasks(projectPath);
  }
  return getCopilotTasks(projectPath);
}

/**
 * Watches the Copilot session-state directory and invokes `onChange` (debounced)
 * whenever any session store changes, so the UI can refresh live.
 * Returns a disposer. Uses native fs.watch — no polling, no extra deps.
 */
export function watchTasks(onChange: () => void): () => void {
  let timer: NodeJS.Timeout | null = null;
  const fire = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(onChange, 300);
  };

  /** Tries to start a recursive watcher on `dir`, falling back to flat. */
  const watchDir = (dir: string): FSWatcher | null => {
    if (!existsSync(dir)) return null;
    try {
      return watch(dir, { recursive: true }, fire);
    } catch {
      try {
        return watch(dir, fire);
      } catch {
        return null;
      }
    }
  };

  const copilotWatcher = watchDir(COPILOT_SESSIONS);
  const claudeWatcher = watchDir(CLAUDE_SESSIONS);

  // If neither watcher could be started, return a no-op disposer.
  if (!copilotWatcher && !claudeWatcher) {
    return () => {};
  }

  return () => {
    if (timer) clearTimeout(timer);
    copilotWatcher?.close();
    claudeWatcher?.close();
  };
}
