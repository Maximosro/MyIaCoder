import { useCallback, useState } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { RefreshCw, GripVertical } from 'lucide-react';
import { useTodos } from '../hooks/useTodos';
import { TodoColumn } from './TodoColumn';
import { TODO_COLUMNS, type TodoColumn as TodoColumnType, type TodoItem } from '../types/todo';

export function TodoKanban() {
  const { items, loading, addItem, updateItem, deleteItem, moveItem, getColumnItems } = useTodos();
  const [activeDragItem, setActiveDragItem] = useState<TodoItem | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const activeId = String(event.active.id);
      const item = items.find((i) => i.id === activeId) ?? null;
      setActiveDragItem(item);
    },
    [items]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveDragItem(null);

      if (!over) return;

      const activeId = String(active.id);
      const overId = String(over.id);

      // Determine target column
      let toColumn: TodoColumnType;

      if (overId.startsWith('col-')) {
        // Dropped directly on a column
        toColumn = overId.replace('col-', '') as TodoColumnType;
      } else {
        // Dropped on another item — use that item's column
        const overItem = items.find((i) => i.id === overId);
        if (!overItem) return;
        toColumn = overItem.column;
      }

      // Calculate target order (insert at the end of column by default,
      // or at the position of the target item)
      const columnItems = getColumnItems(toColumn);
      let toOrder = columnItems.length; // End by default

      if (!overId.startsWith('col-')) {
        const overIndex = columnItems.findIndex((i) => i.id === overId);
        if (overIndex !== -1) {
          toOrder = overIndex;
        }
      }

      moveItem(activeId, toColumn, toOrder);
    },
    [items, moveItem, getColumnItems]
  );

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <RefreshCw className="w-6 h-6 text-[#d4a44a] animate-spin" />
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="h-full flex gap-4 p-4">
        {TODO_COLUMNS.map((col) => (
          <TodoColumn
            key={col.id}
            column={col}
            items={getColumnItems(col.id)}
            onAdd={addItem}
            onUpdate={updateItem}
            onDelete={deleteItem}
          />
        ))}
      </div>

      {/* DragOverlay renders a clone of the dragged card above everything */}
      <DragOverlay dropAnimation={null}>
        {activeDragItem ? (
          <div className="bg-[#0a0a0a] border border-[#d4a44a] rounded p-3 shadow-[0_0_30px_rgba(212,120,74,0.35)] opacity-90 rotate-1 scale-105 cursor-grabbing">
            <div className="flex items-start gap-2">
              <GripVertical className="w-3.5 h-3.5 mt-0.5 text-[#d4a44a] flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-mono text-[#f0ece8] truncate">
                  {activeDragItem.title}
                </p>
                {activeDragItem.description && (
                  <p className="mt-1 text-[11px] font-mono text-[#8b5a3c] line-clamp-2">
                    {activeDragItem.description}
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
