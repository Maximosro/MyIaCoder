import { existsSync, watch, type FSWatcher } from 'node:fs';
import path from 'node:path';
import { COPILOT_SESSIONS, CLAUDE_SESSIONS, type TaskSource, type ProjectTasksResult } from './shared';
import { getCopilotTasks } from './copilot';
import { getClaudeTasks } from './claude';
import { getReasonixTasks, getReasonixDataDir, REASONIX_SESSIONS_ROOT, setReasonixOnChange } from './reasonix';

// ── Public API ──────────────────────────────────────────────
export type { TaskStatus, TaskSource, TaskKind, Task, TaskSession, ProjectTasksResult } from './shared';
export { registerCopilotSession, unregisterCopilotSession, parseCopilotEvents } from './copilot';
export { registerClaudeSession, unregisterClaudeSession } from './claude';
export { registerReasonixSession, unregisterReasonixSession, parseReasonixEvents } from './reasonix';

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
  setReasonixOnChange(onChange);

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
