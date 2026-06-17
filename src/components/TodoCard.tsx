import { useState, useCallback } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Pencil, Trash2, Check, X, GripVertical } from 'lucide-react';
import type { TodoItem } from '../types/todo';

interface TodoCardProps {
  item: TodoItem;
  onUpdate: (id: string, updates: Partial<Pick<TodoItem, 'title' | 'description'>>) => void;
  onDelete: (id: string) => void;
}

export function TodoCard({ item, onUpdate, onDelete }: TodoCardProps) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(item.title);
  const [editDescription, setEditDescription] = useState(item.description);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? 'transform 200ms ease, opacity 200ms ease',
    opacity: isDragging ? 0.4 : 1,
  };

  const handleEnterEdit = useCallback(() => {
    setEditTitle(item.title);
    setEditDescription(item.description);
    setEditing(true);
  }, [item.title, item.description]);

  const handleSave = useCallback(() => {
    if (!editTitle.trim()) return;
    onUpdate(item.id, { title: editTitle.trim(), description: editDescription.trim() });
    setEditing(false);
  }, [editTitle, editDescription, item.id, onUpdate]);

  const handleCancel = useCallback(() => {
    setEditing(false);
  }, []);

  const handleDelete = useCallback(() => {
    onDelete(item.id);
    setConfirmingDelete(false);
  }, [item.id, onDelete]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-[#0a0a0a] border border-[#1f1a15] rounded p-3 select-none transition-all duration-200 ${
        isDragging ? 'shadow-[0_0_20px_rgba(212,120,74,0.25)] z-50 scale-[1.02]' : 'hover:border-[#8b5a3c]/40'
      }`}
    >
      {editing ? (
        /* ── Edit mode ── */
        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') handleCancel();
            }}
            className="w-full bg-[#050505] border border-[#1f1a15] rounded px-2 py-1 text-sm font-mono text-[#f0ece8] placeholder-[#4a2a1a] outline-none focus:border-[#d4784a]/50 transition-colors"
            placeholder="Task title"
            autoFocus
          />
          <textarea
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') handleCancel();
            }}
            className="w-full bg-[#050505] border border-[#1f1a15] rounded px-2 py-1 text-xs font-mono text-[#b0a89a] placeholder-[#4a2a1a] outline-none focus:border-[#d4784a]/50 transition-colors resize-none h-16"
            placeholder="Description (optional)"
          />
          <div className="flex gap-1.5 justify-end">
            <button
              onClick={handleSave}
              className="p-1 rounded hover:bg-[#0a1a0e] text-[#6ba86b] transition-colors"
              title="Save"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleCancel}
              className="p-1 rounded hover:bg-[#1a0a0a] text-[#e05555] transition-colors"
              title="Cancel"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        /* ── View mode ── */
        <div>
          {/* Header row: drag handle + title + actions */}
          <div className="flex items-start gap-2">
            {/* Drag handle */}
            <button
              {...attributes}
              {...listeners}
              className="mt-0.5 p-0.5 cursor-grab active:cursor-grabbing text-[#4a2a1a] hover:text-[#8b5a3c] transition-colors flex-shrink-0"
              title="Drag to reorder"
            >
              <GripVertical className="w-3.5 h-3.5" />
            </button>

            {/* Title */}
            <span
              className="flex-1 text-sm font-mono text-[#f0ece8] truncate cursor-pointer hover:text-[#d4784a] transition-colors"
              onDoubleClick={handleEnterEdit}
              title="Double-click to edit"
            >
              {item.title}
            </span>

            {/* Action buttons */}
            <div className="flex items-center gap-0.5 flex-shrink-0">
              {confirmingDelete ? (
                <>
                  <span className="text-[10px] font-mono text-[#e05555] mr-1">Delete?</span>
                  <button
                    onClick={handleDelete}
                    className="p-0.5 rounded hover:bg-[#0a1a0e] text-[#e05555] hover:text-[#ff6b6b] transition-colors"
                    title="Yes, delete"
                  >
                    <Check className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => setConfirmingDelete(false)}
                    className="p-0.5 rounded hover:bg-[#1a0a0a] text-[#8b5a3c] hover:text-[#b0a89a] transition-colors"
                    title="No, keep"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleEnterEdit}
                    className="p-0.5 rounded hover:bg-[#0f0f0f] text-[#4a2a1a] hover:text-[#d4784a] transition-colors"
                    title="Edit task"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => setConfirmingDelete(true)}
                    className="p-0.5 rounded hover:bg-[#1a0a0a] text-[#4a2a1a] hover:text-[#e05555] transition-colors"
                    title="Delete task"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Description (if present) */}
          {item.description && (
            <p className="mt-1.5 ml-6 text-[11px] font-mono text-[#8b5a3c] line-clamp-2 leading-relaxed">
              {item.description}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
