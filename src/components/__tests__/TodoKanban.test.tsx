// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { TodoKanban } from '../TodoKanban';
import type { TodoItem } from '../../types/todo';

// Mock the useTodos hook
vi.mock('../../hooks/useTodos', () => ({
  useTodos: vi.fn(),
}));

import { useTodos } from '../../hooks/useTodos';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const mockUseTodos = useTodos as ReturnType<typeof vi.fn>;

const baseReturn = {
  items: [] as TodoItem[],
  loading: false,
  addItem: vi.fn(),
  updateItem: vi.fn(),
  deleteItem: vi.fn(),
  moveItem: vi.fn(),
  getColumnItems: vi.fn(() => []),
};

describe('TodoKanban', () => {
  it('shows loading spinner when loading', () => {
    mockUseTodos.mockReturnValue({ ...baseReturn, loading: true });
    render(<TodoKanban />);
    // Spinner is present (we check for the animate-spin class on an svg)
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).not.toBeNull();
  });

  it('shows columns even when no items (empty state)', () => {
    mockUseTodos.mockReturnValue({ ...baseReturn, loading: false, items: [] });
    render(<TodoKanban />);
    // Columns should always be visible so user can click + to add tasks
    expect(screen.getByText('To Do')).toBeDefined();
    expect(screen.getByText('In Progress')).toBeDefined();
    expect(screen.getByText('Done')).toBeDefined();
  });

  it('renders 3 columns when items exist', () => {
    const sampleItems: TodoItem[] = [
      { id: '1', title: 'Task 1', description: '', column: 'todo', order: 0, createdAt: '2026-01-01T00:00:00Z' },
    ];
    const getColumnItems = vi.fn((col: string) => {
      if (col === 'todo') return sampleItems;
      return [];
    });
    mockUseTodos.mockReturnValue({
      ...baseReturn,
      loading: false,
      items: sampleItems,
      getColumnItems,
    });
    render(<TodoKanban />);

    // Should show column labels
    expect(screen.getByText('To Do')).toBeDefined();
    expect(screen.getByText('In Progress')).toBeDefined();
    expect(screen.getByText('Done')).toBeDefined();
  });
});
