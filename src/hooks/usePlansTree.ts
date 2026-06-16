import { useEffect, useState, useCallback } from 'react';
import type { TreeNode } from '../types/project';

interface UsePlansTreeReturn {
  tree: TreeNode[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function usePlansTree(refreshKey?: string): UsePlansTreeReturn {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.readPlansTree();
      setTree(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load RPI plans tree';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, refreshKey]);

  return { tree, loading, error, refresh };
}
