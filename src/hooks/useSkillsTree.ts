import { useEffect, useState, useCallback } from 'react';
import type { TreeNode } from '../types/project';

interface UseSkillsTreeReturn {
  tree: TreeNode[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useSkillsTree(refreshKey?: number): UseSkillsTreeReturn {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.readSkillsTree();
      setTree(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load skills tree';
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
