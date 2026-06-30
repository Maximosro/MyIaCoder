import { existsSync, readdirSync, readFileSync, statSync, watch, type FSWatcher } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
// ponytail: dynamic import — better-sqlite3 is native and may fail to install.
// Only Copilot needs it; the rest of the app must not crash without it.
type DatabaseCtor = new (...args: any[]) => { close(): void; pragma(s: string): void; prepare(s: string): { all(): unknown[]; get(): unknown } };
let Database: DatabaseCtor | null = null;
let dbImportFailed = false;

function getDatabase(): DatabaseCtor | null {
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

const HOME = os.homedir();
const COPILOT_SESSIONS = path.join(HOME, '.copilot', 'session-state');
const CLAUDE_SESSIONS = path.join(HOME, '.claude', 'sessions');
const CLAUDE_PROJECTS = path.join(HOME, '.claude', 'projects');

/**
 * Reasonix 1.8.0+ stores its data under the OS application data directory
 * instead of the legacy ~/.reasonix. This function resolves the base directory
 * consistently with what `reasonix doctor` reports on each platform.
 */
function getReasonixDataDir(): string {
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(HOME, 'AppData', 'Roaming'), 'reasonix');
  }
  if (process.platform === 'darwin') {
    return path.join(HOME, 'Library', 'Application Support', 'reasonix');
  }
  // Linux: Go's os.UserConfigDir() = $XDG_CONFIG_HOME or ~/.config (reasonix 1.8.0
  // persists sessions under the config root, not the XDG data dir).
  return path.join(process.env.XDG_CONFIG_HOME || path.join(HOME, '.config'), 'reasonix');
}

/**
 * Reasonix 1.8.0+ organises sessions by project slug under
 * `projects/<slug>/sessions/`.  A project slug is the path with colons,
 * slashes, and backslashes replaced by hyphens (e.g.
 * C:\Workspace\MyIaCoder → C--Workspace-MyIaCoder).
 */
function reasonixProjectSlug(projectPath: string): string {
  return projectPath.replace(/[:\\/]/g, '-');
}

/** Returns the Reasonix sessions directory for a specific project. */
function getReasonixSessionsDir(projectPath: string): string {
  return path.join(getReasonixDataDir(), 'projects', reasonixProjectSlug(projectPath), 'sessions');
}

/** Top-level Reasonix sessions directory (non-project-specific fallback). */
const REASONIX_SESSIONS_ROOT = path.join(getReasonixDataDir(), 'sessions');

/** Reasonix subagent skills are surfaced to the model as ordinary tools; a tool
 *  call whose name is in this set is an agent dispatch (shown as a subagent),
 *  everything else is a plain tool invocation.
 *  ponytail: fixed builtin set from the reasonix binary; extend if new
 *  runAs=subagent skills are added.  Last synced: v1.13.0. */
const REASONIX_SUBAGENT_TOOLS = new Set([
  'explore', 'research', 'review', 'security_review', 'task',
  'read_only_task', 'read_only_skill', 'parallel_tasks',
]);

/**
 * Tracks which project paths have open Reasonix terminal tabs and when the
 * first tab was opened.  Reasonix ≥ 1.8.0 creates session files lazily (when
 * the user types a message).  Sessions whose transcript mtime is older than
 * `since` are hidden — that filters out historical sessions and only shows
 * work from the current tab session.
 *
 * Each entry also holds a dedicated fs.watch on the project's sessions
 * directory so file changes fire immediately, even on Windows where a
 * recursive watch on the parent `projects/` dir (started at boot) may miss
 * newly created subdirectories.
 *
 * Map: normalized projectPath → { tabs, since, watcher }
 */
const reasonixOpenProjects = new Map<string, {
  tabs: Set<string>;
  since: number;
  watcher: FSWatcher | null;
}>();

/** Debounced onChange callback set by watchTasks.  Used by per-project
 *  watchers set up in registerReasonixSession. */
let reasonixOnChange: (() => void) | null = null;

/** Register that a Reasonix terminal tab is open for a project.
 *  Records the current time as the "since" watermark and starts a watcher on
 *  the project's sessions directory if this is the first tab. */
export function registerReasonixSession(tabId: string, projectPath: string): void {
  const key = normPath(projectPath);
  let entry = reasonixOpenProjects.get(key);
  if (!entry) {
    // Start a dedicated watcher on this project's sessions directory so file
    // changes are detected immediately — the global watcher on projects/
    // started at app boot won't see directories created later.
    let watcher: FSWatcher | null = null;
    const sessionsDir = getReasonixSessionsDir(projectPath);
    const onChange = reasonixOnChange;
    if (onChange) {
      // Walk up: watch the shallowest existing ancestor, recursively.
      let dirToWatch = sessionsDir;
      while (dirToWatch && !existsSync(dirToWatch)) {
        const parent = path.dirname(dirToWatch);
        if (parent === dirToWatch) break;
        dirToWatch = parent;
      }
      if (dirToWatch && existsSync(dirToWatch)) {
        // Debounce identically to the global watcher (80 ms) so rapid
        // writes don't flood the IPC with tasks-changed events.
        let debounce: NodeJS.Timeout | null = null;
        const fire = () => {
          if (debounce) clearTimeout(debounce);
          debounce = setTimeout(onChange, 80);
        };
        try {
          watcher = watch(dirToWatch, { recursive: true }, fire);
        } catch {
          try {
            watcher = watch(dirToWatch, fire);
          } catch { /* best-effort */ }
        }
      }
    }

    entry = { tabs: new Set(), since: Date.now(), watcher };
    reasonixOpenProjects.set(key, entry);
  }
  entry.tabs.add(tabId);
}

/** Unregister a Reasonix terminal tab.  If it was the last tab for its
 *  project, closes the watcher and removes the entry so sessions disappear
 *  from the panel. */
export function unregisterReasonixSession(tabId: string): void {
  for (const [key, entry] of reasonixOpenProjects) {
    if (entry.tabs.has(tabId)) {
      entry.tabs.delete(tabId);
      if (entry.tabs.size === 0) {
        entry.watcher?.close();
        reasonixOpenProjects.delete(key);
      }
      return;
    }
  }
}

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

/** Short, human-readable subject pulled from a tool call's JSON args. */
function reasonixArgSubject(argsRaw?: string): string {
  if (!argsRaw) return '';
  let a: Record<string, unknown>;
  try {
    a = JSON.parse(argsRaw);
  } catch {
    return '';
  }
  for (const k of ['task', 'description', 'prompt', 'command', 'path', 'file_path', 'pattern', 'query']) {
    const v = a[k];
    if (typeof v === 'string' && v.trim()) return v.trim().replace(/\s+/g, ' ').slice(0, 80);
  }
  return '';
}

/**
 * Metadata for a Reasonix subagent stored in the subagents/ directory.
 * Reasonix ≥ 1.8.0 writes `sa_*.meta.json` files next to each subagent
 * transcript, recording status, model, and the parent tool-call id.
 */
interface ReasonixSubagentMeta {
  ref?: string;
  createdAt?: string;
  updatedAt?: string;
  status?: string;            // "running" | "completed" | "failed"
  kind?: string;
  name?: string;
  workspaceRoot?: string;
  parentSession?: string;
  parentToolCallId?: string;
  model?: string;
  effort?: string;
}

/**
 * Reads subagent metadata from the `subagents/` directory within a session
 * directory.  Returns a map from parent tool-call id → metadata so status and
 * model can be merged into the tasks extracted from the session transcript.
 */
function readReasonixSubagents(sessionDir: string): Map<string, ReasonixSubagentMeta> {
  const map = new Map<string, ReasonixSubagentMeta>();
  const subagentsDir = path.join(sessionDir, 'subagents');
  if (!existsSync(subagentsDir)) return map;

  let subFiles: string[];
  try {
    subFiles = readdirSync(subagentsDir);
  } catch {
    return map;
  }

  for (const f of subFiles) {
    if (!f.endsWith('.meta.json')) continue;
    let meta: ReasonixSubagentMeta;
    try {
      meta = JSON.parse(readFileSync(path.join(subagentsDir, f), 'utf-8'));
    } catch {
      continue;
    }
    if (meta.parentToolCallId) {
      map.set(meta.parentToolCallId, meta);
    }
  }
  return map;
}

/**
 * Parses a Reasonix ≥ 1.8.0 session transcript JSONL into tasks.  Each
 * `assistant` message with a `tool_calls` array becomes one or more tasks;
 * matching `tool` messages complete them.  Subagent tool calls stay
 * `in_progress` until the caller merges subagent metadata.
 *
 * Exported for unit testing.
 */
export function parseReasonixEvents(raw: string): Task[] {
  const order: string[] = [];
  const starts = new Map<string, Task>();

  for (const line of raw.split('\n')) {
    if (!line) continue;

    // Fast-path: skip lines that can't possibly contain tool calls or results.
    if (!line.includes('tool_calls') && !line.includes('tool_call_id')) continue;

    let msg: {
      role?: string;
      tool_calls?: Array<{ id?: string; name?: string; arguments?: string }>;
      tool_call_id?: string;
      name?: string;
    };
    try { msg = JSON.parse(line); } catch { continue; }

    // ── Assistant message with tool_calls → subagent dispatch ──
    // Only tool calls that spawn subagents (explore, research, review, …)
    // are shown in the panel.  Plain tools (read_file, bash, glob, etc.) are
    // implementation details of the main agent and are skipped.
    if (msg.role === 'assistant' && msg.tool_calls) {
      for (const tc of msg.tool_calls) {
        if (!tc.id) continue;
        const name = tc.name ?? 'unknown';
        if (!REASONIX_SUBAGENT_TOOLS.has(name)) continue;
        const subject = reasonixArgSubject(tc.arguments);
        const task: Task = {
          id: tc.id,
          title: subject ? `${name}: ${subject}` : name,
          description: subject,
          status: 'in_progress',
          kind: 'subagent',
          agentType: name,
          createdAt: '',
          updatedAt: '',
          dependsOn: [],
        };
        starts.set(tc.id, task);
        order.push(tc.id);
      }
    }
  }

  const tasks = order.map((id) => starts.get(id)!);
  // Cap to the most recent 50 calls so a long session doesn't flood the panel.
  return tasks.slice(-50);
}

/**
 * Reads Reasonix ≥ 1.8.0 tasks for a project.  Scans the project-specific
 * sessions directory (`projects/<slug>/sessions/`) for session transcript
 * `.jsonl` files, parses tool calls out of the transcript, and merges subagent
 * completion status from `subagents/*.meta.json` files.  All sessions for the
 * project are shown as long as at least one Reasonix terminal tab is open for
 * that project — session files are created lazily (on first message), so we
 * can't discover them at launch time.
 */
function getReasonixTasks(projectPath: string): ProjectTasksResult {
  const sessions: TaskSession[] = [];

  const key = normPath(projectPath);
  const entry = reasonixOpenProjects.get(key);

  // Only show sessions when at least one Reasonix tab is open for this project.
  if (!entry) {
    return { source: 'reasonix', sessions };
  }

  const sessionsDir = getReasonixSessionsDir(projectPath);
  if (!existsSync(sessionsDir)) {
    return { source: 'reasonix', sessions };
  }

  let sessionFiles: string[];
  try {
    sessionFiles = readdirSync(sessionsDir);
  } catch (err) {
    return { source: 'reasonix', sessions, error: err instanceof Error ? err.message : 'Cannot read reasonix sessions' };
  }

  for (const f of sessionFiles) {
    // Session transcripts: <timestamp>-<model>.jsonl
    if (!f.endsWith('.jsonl') || f.includes('.ckpt')) continue;

    const transcriptPath = path.join(sessionsDir, f);

    // Skip session files older than the first tab open time — they belong
    // to previous sessions and are no longer live.
    let mtimeMs = 0;
    try {
      mtimeMs = statSync(transcriptPath).mtimeMs;
    } catch {
      /* keep 0 — file may have been deleted between readdir and stat */
    }
    if (mtimeMs < entry.since) continue;

    let transcript: string;
    try {
      transcript = readFileSync(transcriptPath, 'utf-8');
    } catch {
      continue;
    }

    let updatedAt = '';
    try {
      updatedAt = statSync(transcriptPath).mtime.toISOString();
    } catch {
      /* keep '' */
    }

    // Read subagent metadata so we can update subagent status/model.
    const subagents = readReasonixSubagents(sessionsDir);

    try {
      const tasks = parseReasonixEvents(transcript);

      // Merge subagent metadata into tasks.
      for (const task of tasks) {
        if (task.kind !== 'subagent') continue;
        const meta = subagents.get(task.id);
        if (!meta) {
          // Subagent not (yet) persisted — stays in_progress.
          continue;
        }
        if (meta.status === 'completed') {
          task.status = 'done';
        } else if (meta.status === 'failed') {
          task.status = 'blocked';
        }
        if (meta.model) {
          // Extract just the model name from "provider/model" format.
          const parts = meta.model.split('/');
          task.model = parts[parts.length - 1] || meta.model;
        }
        task.updatedAt = meta.updatedAt ?? task.updatedAt;
      }

      if (tasks.length > 0) {
        // Use the session filename as label (strip .jsonl).
        const label = f.replace(/\.jsonl$/, '');
        sessions.push({ sessionId: f, name: label, updatedAt, live: true, tasks });
      }
    } catch {
      // Session transcript locked/corrupt — skip, keep the rest.
    }
  }

  sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return { source: 'reasonix', sessions };
}

/**
 * Reads task-like activity from the selected CLI session store.
 */
export function getProjectTasks(projectPath: string, source: TaskSource): ProjectTasksResult {
  if (source === 'claude') {
    return getClaudeTasks(projectPath);
  }
  if (source === 'reasonix') {
    return getReasonixTasks(projectPath);
  }
  return getCopilotTasks(projectPath);
}

/**
 * Watches CLI session-state directories and invokes `onChange` (debounced)
 * whenever any session store changes, so the UI can refresh live.
 * Returns a disposer. Uses native fs.watch — no polling, no extra deps.
 */
export function watchTasks(onChange: () => void): () => void {
  // Store the callback so registerReasonixSession can set up per-project
  // watchers that also fire tasks-changed.
  reasonixOnChange = onChange;

  let timer: NodeJS.Timeout | null = null;
  const fire = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(onChange, 80); // fast enough to feel instant, long enough to batch rapid writes
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
  // Reasonix ≥ 1.8.0 stores sessions under projects/<slug>/sessions/ and
  // also under a top-level sessions/ dir.  Watch both so task changes are
  // picked up regardless of where the session lands.
  const reasonixProjectsDir = path.join(getReasonixDataDir(), 'projects');
  const reasonixProjectsWatcher = watchDir(reasonixProjectsDir);
  const reasonixRootWatcher = watchDir(REASONIX_SESSIONS_ROOT);

  const reasonixWatchers = [reasonixProjectsWatcher, reasonixRootWatcher].filter(Boolean);

  // If no watcher could be started, return a no-op disposer.
  if (!copilotWatcher && !claudeWatcher && reasonixWatchers.length === 0) {
    return () => {};
  }

  return () => {
    if (timer) clearTimeout(timer);
    copilotWatcher?.close();
    claudeWatcher?.close();
    reasonixProjectsWatcher?.close();
    reasonixRootWatcher?.close();
  };
}
