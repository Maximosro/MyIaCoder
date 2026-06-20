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
 */
export function useTasks(
  projectPath: string | null,
  source: TaskSource,
  refreshKey?: number,
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

  // A CLI process exiting writes nothing to disk, so fs.watch can't see it.
  // Poll only while a session is shown, to drop tasks shortly after the
  // terminal closes. Stops itself once nothing is live.
  useEffect(() => {
    if (sessions.length === 0) return;
    const id = setInterval(refresh, 4000);
    return () => clearInterval(id);
  }, [sessions.length, refresh]);

  return { sessions, loading, error, refresh };
}
