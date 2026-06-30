import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import {
  CLAUDE_SESSIONS,
  CLAUDE_PROJECTS,
  normPath,
  projectPathToSlug,
  type Task,
  type TaskSession,
  type ProjectTasksResult,
} from './shared';

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
export function getClaudeTasks(projectPath: string): ProjectTasksResult {
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
