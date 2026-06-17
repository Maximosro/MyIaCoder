// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { TodoCard } from '../TodoCard';
import type { TodoItem } from '../../types/todo';

afterEach(() => {
  cleanup();
});

const mockItem: TodoItem = {
  id: 'test-1',
  title: 'Test Task',
  description: 'A test description',
  column: 'todo',
  order: 0,
  createdAt: '2026-01-01T00:00:00Z',
};

describe('TodoCard', () => {
  it('renders title and description', () => {
    render(
      <TodoCard item={mockItem} onUpdate={vi.fn()} onDelete={vi.fn()} />
    );
    expect(screen.getByText('Test Task')).toBeDefined();
    expect(screen.getByText('A test description')).toBeDefined();
  });

  it('renders without description when empty', () => {
    const noDesc = { ...mockItem, description: '' };
    render(
      <TodoCard item={noDesc} onUpdate={vi.fn()} onDelete={vi.fn()} />
    );
    expect(screen.getByText('Test Task')).toBeDefined();
    expect(screen.queryByText('A test description')).toBeNull();
  });

  it('enters edit mode on pencil click', () => {
    const onUpdate = vi.fn();
    render(
      <TodoCard item={mockItem} onUpdate={onUpdate} onDelete={vi.fn()} />
    );

    const pencilBtn = screen.getByTitle('Edit task');
    fireEvent.click(pencilBtn);

    // Should show input with current title
    const input = screen.getByDisplayValue('Test Task') as HTMLInputElement;
    expect(input).toBeDefined();
  });

  it('saves edit on Check click', () => {
    const onUpdate = vi.fn();
    render(
      <TodoCard item={mockItem} onUpdate={onUpdate} onDelete={vi.fn()} />
    );

    // Enter edit mode
    fireEvent.click(screen.getByTitle('Edit task'));

    // Change title
    const input = screen.getByDisplayValue('Test Task') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Updated Title' } });

    // Click save
    fireEvent.click(screen.getByTitle('Save'));

    expect(onUpdate).toHaveBeenCalledWith('test-1', {
      title: 'Updated Title',
      description: 'A test description',
    });
  });

  it('cancels edit on X click', () => {
    const onUpdate = vi.fn();
    render(
      <TodoCard item={mockItem} onUpdate={onUpdate} onDelete={vi.fn()} />
    );

    fireEvent.click(screen.getByTitle('Edit task'));
    fireEvent.click(screen.getByTitle('Cancel'));

    expect(onUpdate).not.toHaveBeenCalled();
    // Should be back in view mode
    expect(screen.getByText('Test Task')).toBeDefined();
  });

  it('shows delete confirmation on trash click', () => {
    render(
      <TodoCard item={mockItem} onUpdate={vi.fn()} onDelete={vi.fn()} />
    );

    fireEvent.click(screen.getByTitle('Delete task'));

    // Should show "Delete?" text
    expect(screen.getByText('Delete?')).toBeDefined();
  });

  it('calls onDelete on confirmation', () => {
    const onDelete = vi.fn();
    render(
      <TodoCard item={mockItem} onUpdate={vi.fn()} onDelete={onDelete} />
    );

    fireEvent.click(screen.getByTitle('Delete task'));
    // Click Yes (Check button in confirm mode)
    fireEvent.click(screen.getByTitle('Yes, delete'));

    expect(onDelete).toHaveBeenCalledWith('test-1');
  });

  it('cancels delete on X click in confirm mode', () => {
    const onDelete = vi.fn();
    render(
      <TodoCard item={mockItem} onUpdate={vi.fn()} onDelete={onDelete} />
    );

    fireEvent.click(screen.getByTitle('Delete task'));
    fireEvent.click(screen.getByTitle('No, keep'));

    expect(onDelete).not.toHaveBeenCalled();
    // Should be back to normal view
    expect(screen.queryByText('Delete?')).toBeNull();
  });

  it('has drag handle with grip icon', () => {
    render(
      <TodoCard item={mockItem} onUpdate={vi.fn()} onDelete={vi.fn()} />
    );

    const gripHandle = screen.getByTitle('Drag to reorder');
    expect(gripHandle).toBeDefined();
  });
});
