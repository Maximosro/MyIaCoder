import { useState, useCallback } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus, Check, X } from 'lucide-react';
import type { TodoItem, TodoColumn as TodoColumnType } from '../types/todo';
import { TodoCard } from './TodoCard';

interface TodoColumnProps {
  column: { id: TodoColumnType; label: string };
  items: TodoItem[];
  onAdd: (title: string, description: string, column: TodoColumnType) => void;
  onUpdate: (id: string, updates: Partial<Pick<TodoItem, 'title' | 'description'>>) => void;
  onDelete: (id: string) => void;
}

export function TodoColumn({ column, items, onAdd, onUpdate, onDelete }: TodoColumnProps) {
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');

  const droppableId = `col-${column.id}`;
  const { setNodeRef, isOver } = useDroppable({ id: droppableId });

  const handleAddSave = useCallback(() => {
    if (!newTitle.trim()) return;
    onAdd(newTitle.trim(), newDescription.trim(), column.id);
    setNewTitle('');
    setNewDescription('');
    setAdding(false);
  }, [newTitle, newDescription, column.id, onAdd]);

  const handleAddCancel = useCallback(() => {
    setNewTitle('');
    setNewDescription('');
    setAdding(false);
  }, []);

  return (
    <div className="flex-1 min-w-[280px] flex flex-col bg-[#080808] border border-[#1f1a15] rounded">
      {/* Column header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#1f1a15]">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-[#f0ece8] tracking-wider uppercase">
            {column.label}
          </span>
          <span className="text-[10px] font-mono text-[#8b5a3c] bg-[#050505] px-1.5 py-0.5 rounded">
            {items.length}
          </span>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="p-1 rounded hover:bg-[#0f0f0f] text-[#8b5a3c] hover:text-[#d4a44a] transition-colors"
          title="Add task"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Column body */}
      <div
        ref={setNodeRef}
        className={`flex-1 flex flex-col gap-2 p-2 overflow-y-auto transition-all duration-300 ${
          isOver ? 'bg-[#1a0f0a]/40 ring-1 ring-[#d4a44a]/30' : ''
        }`}
      >
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          {items.map((item) => (
            <TodoCard
              key={item.id}
              item={item}
              onUpdate={onUpdate}
              onDelete={onDelete}
            />
          ))}
        </SortableContext>

        {/* Inline add form */}
        {adding && (
          <div className="flex flex-col gap-2 bg-[#0a0a0a] border border-[#d4a44a]/30 rounded p-2 animate-fade-in">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddSave();
                if (e.key === 'Escape') handleAddCancel();
              }}
              className="w-full bg-[#050505] border border-[#1f1a15] rounded px-2 py-1 text-sm font-mono text-[#f0ece8] placeholder-[#4a2a1a] outline-none focus:border-[#d4784a]/50 transition-colors"
              placeholder="Task title"
              autoFocus
            />
            <textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') handleAddCancel();
              }}
              className="w-full bg-[#050505] border border-[#1f1a15] rounded px-2 py-1 text-xs font-mono text-[#b0a89a] placeholder-[#4a2a1a] outline-none focus:border-[#d4784a]/50 transition-colors resize-none h-14"
              placeholder="Description (optional)"
            />
            <div className="flex gap-1.5 justify-end">
              <button
                onClick={handleAddSave}
                className="p-1 rounded hover:bg-[#0a1a0e] text-[#6ba86b] transition-colors"
                title="Save"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleAddCancel}
                className="p-1 rounded hover:bg-[#1a0a0a] text-[#e05555] transition-colors"
                title="Cancel"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Empty state */}
        {items.length === 0 && !adding && (
          <div className="flex-1 flex items-center justify-center py-8">
            <p className="text-[10px] font-mono text-[#4a2a1a] tracking-wider">
              NO_TASKS
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
