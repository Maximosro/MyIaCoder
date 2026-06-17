import { useState, useEffect, useCallback, useRef } from 'react';
import type { TodoItem, TodoColumn } from '../types/todo';

export interface UseTodosReturn {
  items: TodoItem[];
  loading: boolean;
  addItem: (title: string, description: string, column: TodoColumn) => void;
  updateItem: (id: string, updates: Partial<Pick<TodoItem, 'title' | 'description'>>) => void;
  deleteItem: (id: string) => void;
  moveItem: (id: string, toColumn: TodoColumn, toOrder: number) => void;
  getColumnItems: (column: TodoColumn) => TodoItem[];
}

export function useTodos(): UseTodosReturn {
  const [items, setItems] = useState<TodoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const itemsRef = useRef<TodoItem[]>([]);

  // Keep ref in sync for persist debounce
  itemsRef.current = items;

  // Load todos on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Race with a 5s timeout to prevent eternal loading if IPC handler is missing
        const loaded = await Promise.race([
          window.electronAPI.loadTodos(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('IPC_TIMEOUT')), 5000)
          ),
        ]);
        if (!cancelled) {
          setItems(loaded);
          setLoading(false);
        }
      } catch (err) {
        console.error('[useTodos] Failed to load todos:', err);
        if (!cancelled) {
          setItems([]);
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist with 300ms debounce
  const persist = useCallback(() => {
    if (persistTimerRef.current) {
      clearTimeout(persistTimerRef.current);
    }
    persistTimerRef.current = setTimeout(() => {
      window.electronAPI.saveTodos(itemsRef.current).catch((err) => {
        console.error('[useTodos] Failed to save todos:', err);
      });
    }, 300);
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
        // Flush pending saves
        window.electronAPI.saveTodos(itemsRef.current).catch(() => {});
      }
    };
  }, []);

  const addItem = useCallback((title: string, description: string, column: TodoColumn) => {
    if (!title.trim()) return;
    const maxOrder = itemsRef.current
      .filter((i) => i.column === column)
      .reduce((max, i) => Math.max(max, i.order), -1);
    const newItem: TodoItem = {
      id: crypto.randomUUID(),
      title: title.trim(),
      description: description.trim(),
      column,
      order: maxOrder + 1,
      createdAt: new Date().toISOString(),
    };
    setItems((prev) => [...prev, newItem]);
    persist();
  }, [persist]);

  const updateItem = useCallback((id: string, updates: Partial<Pick<TodoItem, 'title' | 'description'>>) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, ...updates } : item
      )
    );
    persist();
  }, [persist]);

  const deleteItem = useCallback((id: string) => {
    setItems((prev) => {
      const item = prev.find((i) => i.id === id);
      if (!item) return prev;
      const column = item.column;
      const filtered = prev.filter((i) => i.id !== id);
      // Recalculate order for remaining items in the same column
      const columnItems = filtered
        .filter((i) => i.column === column)
        .sort((a, b) => a.order - b.order);
      const reordered = columnItems.map((i, idx) => ({ ...i, order: idx }));
      const others = filtered.filter((i) => i.column !== column);
      return [...others, ...reordered];
    });
    persist();
  }, [persist]);

  const moveItem = useCallback((id: string, toColumn: TodoColumn, toOrder: number) => {
    setItems((prev) => {
      const item = prev.find((i) => i.id === id);
      if (!item) return prev;

      // No-op: same column and same order
      if (item.column === toColumn && item.order === toOrder) return prev;

      const fromColumn = item.column;

      // Remove item from source column and recalculate orders
      const withoutItem = prev.filter((i) => i.id !== id);

      // Recalculate source column orders
      const srcItems = withoutItem
        .filter((i) => i.column === fromColumn)
        .sort((a, b) => a.order - b.order)
        .map((i, idx) => ({ ...i, order: idx }));

      // Recalculate target column orders (insert at toOrder)
      const dstItems = withoutItem
        .filter((i) => i.column === toColumn && i.id !== id)
        .sort((a, b) => a.order - b.order);

      // Insert item at toOrder position
      const movedItem = { ...item, column: toColumn, order: toOrder };
      const before = dstItems.filter((i) => i.order < toOrder);
      const after = dstItems.filter((i) => i.order >= toOrder).map((i) => ({ ...i, order: i.order + 1 }));
      const newDstItems = [...before, movedItem, ...after].map((i, idx) => ({ ...i, order: idx }));

      // Other columns (untouched)
      const others = withoutItem.filter(
        (i) => i.column !== fromColumn && i.column !== toColumn
      );

      return [...others, ...srcItems, ...newDstItems];
    });
    persist();
  }, [persist]);

  const getColumnItems = useCallback((column: TodoColumn): TodoItem[] => {
    return items
      .filter((i) => i.column === column)
      .sort((a, b) => a.order - b.order);
  }, [items]);

  return {
    items,
    loading,
    addItem,
    updateItem,
    deleteItem,
    moveItem,
    getColumnItems,
  };
}
