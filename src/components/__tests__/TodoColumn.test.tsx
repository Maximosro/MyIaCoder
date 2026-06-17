// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { TodoColumn } from '../TodoColumn';
import type { TodoItem } from '../../types/todo';

afterEach(() => {
  cleanup();
});

const mockColumn = { id: 'todo' as const, label: 'To Do' };

const mockItems: TodoItem[] = [
  { id: '1', title: 'Task 1', description: '', column: 'todo', order: 0, createdAt: '2026-01-01T00:00:00Z' },
  { id: '2', title: 'Task 2', description: 'Desc 2', column: 'todo', order: 1, createdAt: '2026-01-02T00:00:00Z' },
];

describe('TodoColumn', () => {
  it('renders column label and item count', () => {
    render(
      <TodoColumn
        column={mockColumn}
        items={mockItems}
        onAdd={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    expect(screen.getByText('To Do')).toBeDefined();
    expect(screen.getByText('2')).toBeDefined();
  });

  it('renders cards for each item', () => {
    render(
      <TodoColumn
        column={mockColumn}
        items={mockItems}
        onAdd={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    expect(screen.getByText('Task 1')).toBeDefined();
    expect(screen.getByText('Task 2')).toBeDefined();
  });

  it('shows add form on + click', () => {
    render(
      <TodoColumn
        column={mockColumn}
        items={[]}
        onAdd={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTitle('Add task'));

    // Should show input
    const input = screen.getByPlaceholderText('Task title') as HTMLInputElement;
    expect(input).toBeDefined();
  });

  it('adds item on form submit', () => {
    const onAdd = vi.fn();
    render(
      <TodoColumn
        column={mockColumn}
        items={[]}
        onAdd={onAdd}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTitle('Add task'));

    const input = screen.getByPlaceholderText('Task title') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'New Task' } });

    const textarea = screen.getByPlaceholderText('Description (optional)') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'New Desc' } });

    fireEvent.click(screen.getByTitle('Save'));

    expect(onAdd).toHaveBeenCalledWith('New Task', 'New Desc', 'todo');
  });

  it('cancels add form on X click', () => {
    const onAdd = vi.fn();
    render(
      <TodoColumn
        column={mockColumn}
        items={[]}
        onAdd={onAdd}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTitle('Add task'));
    fireEvent.click(screen.getByTitle('Cancel'));

    expect(onAdd).not.toHaveBeenCalled();
    expect(screen.queryByPlaceholderText('Task title')).toBeNull();
  });

  it('shows empty state when no items', () => {
    render(
      <TodoColumn
        column={mockColumn}
        items={[]}
        onAdd={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText('NO_TASKS')).toBeDefined();
  });

  it('does not add item with empty title', () => {
    const onAdd = vi.fn();
    render(
      <TodoColumn
        column={mockColumn}
        items={[]}
        onAdd={onAdd}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTitle('Add task'));

    // Try saving with empty title
    fireEvent.click(screen.getByTitle('Save'));

    expect(onAdd).not.toHaveBeenCalled();
  });
});
