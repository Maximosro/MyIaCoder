import { useEffect, useState, useCallback, useRef } from 'react';
import type { TaskSession, TaskSource } from '../types/task';

interface UseTasksReturn {
  sessions: TaskSession[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Fetches CLI tasks for a project + source via IPC, and re-fetches live when the
 * main process signals 'tasks-changed' (a session store on disk changed).
 * Returns an empty list when projectPath is null.
 *
 * When `active` is false, polling runs at a slower pace — the source still
 * listens for `tasks-changed` instantly, so switching tabs shows fresh data
 * immediately without unnecessary IPC traffic for background sources.
 */
export function useTasks(
  projectPath: string | null,
  source: TaskSource,
  refreshKey?: number,
  active = true,
): UseTasksReturn {
  const [sessions, setSessions] = useState<TaskSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!projectPath) {
      setSessions([]);
      setLoading(false);
      setError(null);
      return;
    }

    const currentId = ++requestIdRef.current;
    setLoading(true);
    setError(null);

    try {
      const result = await window.electronAPI.getProjectTasks(projectPath, source);
      if (currentId !== requestIdRef.current) return;

      if (result.error) {
        setError(result.error);
        setSessions([]);
      } else {
        setSessions(result.sessions);
        setError(null);
      }
    } catch (err) {
      if (currentId !== requestIdRef.current) return;
      setError(err instanceof Error ? err.message : 'Failed to fetch tasks');
      setSessions([]);
    } finally {
      if (currentId === requestIdRef.current) setLoading(false);
    }
  }, [projectPath, source]);

  useEffect(() => {
    refresh();
  }, [refresh, refreshKey]);

  // Live refresh when a session store changes on disk.
  useEffect(() => {
    const unsubscribe = window.electronAPI.onTasksChanged(() => {
      refresh();
    });
    return unsubscribe;
  }, [refresh]);

  // Poll for liveness.  Active sources poll fast so tasks appear quickly even
  // if a watcher event is missed; inactive sources poll slowly — just enough to
  // drop tasks when a terminal exits (which writes nothing to disk).
  useEffect(() => {
    let interval: number;
    if (active) {
      interval = sessions.length === 0 ? 500 : 1500;
    } else {
      // Background: 10 s when waiting for first session, 5 s for liveness.
      interval = sessions.length === 0 ? 10_000 : 5_000;
    }
    const id = setInterval(refresh, interval);
    return () => clearInterval(id);
  }, [sessions.length, refresh, active]);

  return { sessions, loading, error, refresh };
}
