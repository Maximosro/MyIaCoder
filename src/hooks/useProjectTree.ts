import { useEffect, useState, useCallback } from 'react';
import type { TreeNode } from '../types/project';

interface UseProjectTreeReturn {
  tree: TreeNode[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useProjectTree(projectPath: string | null): UseProjectTreeReturn {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!projectPath) {
      setTree([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.readProjectTree(projectPath);
      setTree(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load project tree';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [projectPath]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { tree, loading, error, refresh };
}
