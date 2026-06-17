import { useEffect, useState, useCallback, useRef } from 'react';
import type { GitChange } from '../types/project';

interface UseGitChangesReturn {
  changes: GitChange[];
  branch: string;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Fetches git changes for the given project path via IPC.
 * Returns an empty list when projectPath is null.
 * Automatically re-fetches when projectPath or refreshKey changes.
 * Cancels in-flight requests when the projectPath changes.
 */
export function useGitChanges(
  projectPath: string | null,
  refreshKey?: number,
): UseGitChangesReturn {
  const [changes, setChanges] = useState<GitChange[]>([]);
  const [branch, setBranch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!projectPath) {
      setChanges([]);
      setBranch('');
      setLoading(false);
      setError(null);
      return;
    }

    const currentId = ++requestIdRef.current;
    setLoading(true);
    setError(null);

    try {
      const result = await window.electronAPI.getGitChanges(projectPath);
      // Discard stale responses
      if (currentId !== requestIdRef.current) return;

      setBranch(result.branch);
      if (result.error) {
        setError(result.error);
        setChanges([]);
      } else {
        setChanges(result.changes);
        setError(null);
      }
    } catch (err) {
      if (currentId !== requestIdRef.current) return;
      const message = err instanceof Error ? err.message : 'Failed to fetch git changes';
      setError(message);
      setChanges([]);
    } finally {
      if (currentId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [projectPath]);

  useEffect(() => {
    refresh();
  }, [refresh, refreshKey]);

  return { changes, branch, loading, error, refresh };
}
