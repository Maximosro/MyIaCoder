import { app } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export interface TodoItem {
  id: string;
  title: string;
  description: string;
  column: 'todo' | 'in-progress' | 'done';
  order: number;
  createdAt: string;
}

function getTodosPath(): string {
  const dir = path.join(app.getPath('appData'), 'ai-code-manager');
  return path.join(dir, 'todos.json');
}

export function loadTodos(): TodoItem[] {
  const filePath = getTodosPath();
  try {
    if (existsSync(filePath)) {
      const raw = readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed as TodoItem[];
      }
    }
  } catch {
    // Corrupted or missing file — return empty array
    console.warn('[todos] Failed to load todos.json, starting fresh');
  }
  return [];
}

export function saveTodos(items: TodoItem[]): void {
  const filePath = getTodosPath();
  const dir = path.dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(filePath, JSON.stringify(items, null, 2), 'utf-8');
}
