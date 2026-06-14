import { useEffect, useState, useCallback } from 'react';
import type { Project } from '../types/project';

interface UseProjectsReturn {
  projects: Project[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useProjects(): UseProjectsReturn {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.listProjects();
      setProjects(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load projects';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { projects, loading, error, refresh };
}
