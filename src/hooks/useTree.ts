import { useEffect, useState, useCallback } from 'react';
import type { TreeNode } from '../types/project';

export interface UseTreeReturn {
  tree: TreeNode[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Generic directory-tree hook: loads a TreeNode[] from `fetcher` and reloads
 * whenever any value in `deps` changes. `errorMessage` is the fallback shown
 * when the thrown error is not an Error instance.
 */
export function useTree(
  fetcher: () => Promise<TreeNode[]>,
  deps: unknown[] = [],
  errorMessage = 'Failed to load tree',
): UseTreeReturn {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTree(await fetcher());
    } catch (err) {
      setError(err instanceof Error ? err.message : errorMessage);
    } finally {
      setLoading(false);
    }
    // deps drive when a fresh fetcher closure (and reload) is needed
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { tree, loading, error, refresh };
}
