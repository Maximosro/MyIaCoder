import { existsSync, readdirSync, readFileSync, statSync, watch, type FSWatcher } from 'node:fs';
import path from 'node:path';
import { HOME, normPath, type Task, type TaskSession, type ProjectTasksResult } from './shared';

/**
 * Reasonix 1.8.0+ stores its data under the OS application data directory
 * instead of the legacy ~/.reasonix. This function resolves the base directory
 * consistently with what `reasonix doctor` reports on each platform.
 */
export function getReasonixDataDir(): string {
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
export const REASONIX_SESSIONS_ROOT = path.join(getReasonixDataDir(), 'sessions');

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

/** Stores the debounced tasks-changed callback so registerReasonixSession can
 *  set up per-project watchers that also fire it.  Called once by watchTasks. */
export function setReasonixOnChange(onChange: () => void): void {
  reasonixOnChange = onChange;
}

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
export function getReasonixTasks(projectPath: string): ProjectTasksResult {
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
