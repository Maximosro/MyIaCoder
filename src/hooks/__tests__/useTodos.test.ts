// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTodos } from '../useTodos';
import type { TodoItem } from '../../types/todo';

// Mock window.electronAPI
const mockLoadTodos = vi.fn();
const mockSaveTodos = vi.fn();

beforeEach(() => {
  vi.stubGlobal('window', {
    electronAPI: {
      loadTodos: mockLoadTodos,
      saveTodos: mockSaveTodos,
    },
  });
  mockLoadTodos.mockReset();
  mockSaveTodos.mockReset();
  mockLoadTodos.mockResolvedValue([]);
  mockSaveTodos.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// Helper to wait for async load
async function renderUseTodos() {
  const result = renderHook(() => useTodos());
  // Wait for initial load
  await vi.waitFor(() => {
    expect(result.result.current.loading).toBe(false);
  });
  return result;
}

describe('useTodos', () => {
  it('loads todos on mount', async () => {
    const mockItems: TodoItem[] = [
      { id: '1', title: 'Test', description: '', column: 'todo', order: 0, createdAt: '2026-01-01T00:00:00Z' },
    ];
    mockLoadTodos.mockResolvedValue(mockItems);

    const { result } = renderHook(() => useTodos());
    await vi.waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.items).toEqual(mockItems);
    expect(mockLoadTodos).toHaveBeenCalledOnce();
  });

  it('handles load error gracefully', async () => {
    mockLoadTodos.mockRejectedValue(new Error('IPC error'));

    const { result } = renderHook(() => useTodos());
    await vi.waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.items).toEqual([]);
  });

  it('addItem creates a new task', async () => {
    const { result } = await renderUseTodos();

    act(() => {
      result.current.addItem('New Task', 'Description', 'todo');
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].title).toBe('New Task');
    expect(result.current.items[0].description).toBe('Description');
    expect(result.current.items[0].column).toBe('todo');
    expect(result.current.items[0].id).toBeTruthy();
  });

  it('addItem ignores empty title', async () => {
    const { result } = await renderUseTodos();

    act(() => {
      result.current.addItem('  ', 'Desc', 'todo');
    });

    expect(result.current.items).toHaveLength(0);
  });

  it('updateItem modifies title and description', async () => {
    const { result } = await renderUseTodos();

    act(() => {
      result.current.addItem('Old Title', 'Old Desc', 'todo');
    });

    const id = result.current.items[0].id;

    act(() => {
      result.current.updateItem(id, { title: 'New Title', description: 'New Desc' });
    });

    const updated = result.current.items.find((i) => i.id === id);
    expect(updated?.title).toBe('New Title');
    expect(updated?.description).toBe('New Desc');
  });

  it('deleteItem removes a task', async () => {
    const { result } = await renderUseTodos();

    act(() => {
      result.current.addItem('Task to delete', '', 'todo');
    });

    const id = result.current.items[0].id;

    act(() => {
      result.current.deleteItem(id);
    });

    expect(result.current.items).toHaveLength(0);
  });

  it('moveItem changes column', async () => {
    const { result } = await renderUseTodos();

    act(() => {
      result.current.addItem('Movable task', '', 'todo');
    });

    const id = result.current.items[0].id;

    act(() => {
      result.current.moveItem(id, 'done', 0);
    });

    const moved = result.current.items.find((i) => i.id === id);
    expect(moved?.column).toBe('done');
  });

  it('getColumnItems filters by column', async () => {
    const { result } = await renderUseTodos();

    act(() => {
      result.current.addItem('Todo 1', '', 'todo');
      result.current.addItem('Todo 2', '', 'todo');
      result.current.addItem('Done 1', '', 'done');
    });

    const todoItems = result.current.getColumnItems('todo');
    expect(todoItems).toHaveLength(2);
    expect(todoItems.every((i) => i.column === 'todo')).toBe(true);

    const doneItems = result.current.getColumnItems('done');
    expect(doneItems).toHaveLength(1);

    const inProgressItems = result.current.getColumnItems('in-progress');
    expect(inProgressItems).toHaveLength(0);
  });

  it('persists after mutations (debounced)', async () => {
    vi.useFakeTimers();
    const { result } = await renderUseTodos();

    act(() => {
      result.current.addItem('Persist test', '', 'todo');
    });

    // Fast-forward debounce
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(mockSaveTodos).toHaveBeenCalled();
    vi.useRealTimers();
  });
});
