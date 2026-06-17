// ── ToDo / Kanban types ──────────────────────────────────────────

export type TodoColumn = 'todo' | 'in-progress' | 'done';

export interface TodoItem {
  id: string;
  title: string;
  description: string;
  column: TodoColumn;
  order: number;
  createdAt: string;
}

export const TODO_COLUMNS: readonly { id: TodoColumn; label: string }[] = [
  { id: 'todo', label: 'To Do' },
  { id: 'in-progress', label: 'In Progress' },
  { id: 'done', label: 'Done' },
] as const;
