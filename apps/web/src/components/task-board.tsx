'use client';

import React, { useState } from 'react';
import type { TaskDto, TaskStatus } from '@teamos/contracts';
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
} from '@dnd-kit/core';
import { Badge, Button, EmptyState, PriorityBadge } from './ui';
import { SearchIcon, PlusIcon, LockIcon, ClockIcon } from './ui/icons';

interface TaskBoardProps {
  tasks: TaskDto[];
  projectKey: string;
  onSelectTask: (task: TaskDto) => void;
  onQuickStatusChange: (taskId: string, newStatus: TaskStatus, version: number) => void;
  onOpenCreateTask: () => void;
}

const COLUMNS: { id: TaskStatus; label: string; dotColor: string }[] = [
  { id: 'TODO', label: 'To Do', dotColor: 'bg-slate-400' },
  { id: 'IN_PROGRESS', label: 'In Progress', dotColor: 'bg-blue-500' },
  { id: 'DONE', label: 'Done', dotColor: 'bg-emerald-500' },
  { id: 'CANCELLED', label: 'Cancelled', dotColor: 'bg-rose-400' },
];

function KanbanCard({
  task,
  projectKey,
  onSelect,
  isDragging = false,
}: {
  task: TaskDto;
  projectKey: string;
  onSelect?: () => void;
  isDragging?: boolean;
}) {
  const isBlocked = (task as any).isBlocked;

  return (
    <div
      onClick={onSelect}
      className={`bg-white dark:bg-slate-900 p-3.5 rounded-lg border border-slate-200/90 dark:border-slate-800 shadow-xs hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-card-hover transition-all cursor-grab active:cursor-grabbing space-y-2 group select-none ${
        isDragging ? 'opacity-40 rotate-1 shadow-lg border-blue-500' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[10px] font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200/80 dark:border-slate-700">
            {projectKey}-{task.number}
          </span>
          <PriorityBadge priority={task.priority} size="xs" />
          {isBlocked && (
            <Badge variant="warning" size="xs" dot>
              Blocked
            </Badge>
          )}
        </div>
        {task.remainingEstimateWorkdays !== undefined && (
          <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 font-mono flex items-center gap-1">
            <ClockIcon className="w-3 h-3 text-slate-400 dark:text-slate-500" />
            <span>{task.remainingEstimateWorkdays}d</span>
          </span>
        )}
      </div>

      <h5 className="text-xs font-semibold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 line-clamp-2 leading-relaxed transition-colors">
        {task.title}
      </h5>

      <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 dark:text-slate-500">
        <span className="truncate max-w-[100px] text-slate-600 dark:text-slate-400 font-medium">
          {task.assigneeName ? `@${task.assigneeName}` : 'Unassigned'}
        </span>
        {task.dueDate && (
          <span className="text-slate-400 dark:text-slate-500 font-mono">
            Due {task.dueDate}
          </span>
        )}
      </div>
    </div>
  );
}

function DraggableKanbanCard({
  task,
  projectKey,
  onSelect,
}: {
  task: TaskDto;
  projectKey: string;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    data: { task },
  });

  return (
    <div ref={setNodeRef} {...listeners} {...attributes}>
      <KanbanCard
        task={task}
        projectKey={projectKey}
        onSelect={onSelect}
        isDragging={isDragging}
      />
    </div>
  );
}

function DroppableKanbanColumn({
  col,
  tasks,
  projectKey,
  onSelectTask,
}: {
  col: (typeof COLUMNS)[0];
  tasks: TaskDto[];
  projectKey: string;
  onSelectTask: (task: TaskDto) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: col.id,
  });

  return (
    <div
      ref={setNodeRef}
      className={`bg-slate-50/80 dark:bg-slate-950/50 rounded-xl p-3 border transition-colors flex flex-col min-h-[480px] ${
        isOver
          ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/30 dark:bg-blue-950/20'
          : 'border-slate-200/80 dark:border-slate-800'
      }`}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-200/70 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${col.dotColor}`} />
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 tracking-tight">
            {col.label}
          </span>
        </div>
        <span className="font-mono text-[11px] font-bold text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900 px-2 py-0.2 rounded-full border border-slate-200 dark:border-slate-700">
          {tasks.length}
        </span>
      </div>

      {/* Column Task Cards */}
      <div className="space-y-2.5 flex-1 overflow-y-auto">
        {tasks.map((task) => (
          <DraggableKanbanCard
            key={task.id}
            task={task}
            projectKey={projectKey}
            onSelect={() => onSelectTask(task)}
          />
        ))}

        {tasks.length === 0 && (
          <div className="h-28 flex items-center justify-center text-[11px] text-slate-400 dark:text-slate-600 border border-dashed border-slate-200 dark:border-slate-800/80 rounded-lg">
            Drop tasks here
          </div>
        )}
      </div>
    </div>
  );
}

export function TaskBoard({
  tasks,
  projectKey,
  onSelectTask,
  onQuickStatusChange,
  onOpenCreateTask,
}: TaskBoardProps) {
  const [viewMode, setViewMode] = useState<'board' | 'table'>('board');
  const [search, setSearch] = useState('');
  const [activeTask, setActiveTask] = useState<TaskDto | null>(null);

  // Require small pointer movement before dragging starts to allow smooth clicking
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
  );

  const filteredTasks = tasks.filter((t) =>
    search.trim() ? t.title.toLowerCase().includes(search.toLowerCase()) : true,
  );

  function handleDragStart(event: DragStartEvent) {
    const task = tasks.find((t) => t.id === event.active.id);
    if (task) {
      setActiveTask(task);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const targetColumnId = over.id as TaskStatus;
    const task = tasks.find((t) => t.id === active.id);

    if (task && task.status !== targetColumnId) {
      onQuickStatusChange(task.id, targetColumnId, task.version);
    }
  }

  return (
    <div className="space-y-4">
      {/* Search, View Toggle & Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-2.5 flex-1">
          <div className="relative w-full sm:w-72">
            <SearchIcon className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter tasks by title..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors"
            />
          </div>

          <div className="flex rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-800 p-0.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setViewMode('board')}
              className={`px-3 py-1 rounded-md text-[11px] font-medium transition-all ${
                viewMode === 'board'
                  ? 'bg-white dark:bg-slate-900 shadow-xs text-blue-600 dark:text-blue-400 font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Board
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-3 py-1 rounded-md text-[11px] font-medium transition-all ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-slate-900 shadow-xs text-blue-600 dark:text-blue-400 font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Table
            </button>
          </div>
        </div>

        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={onOpenCreateTask}
          leftIcon={<PlusIcon className="w-3.5 h-3.5" />}
        >
          Add Task
        </Button>
      </div>

      {filteredTasks.length === 0 ? (
        <EmptyState
          title="No tasks found"
          description={
            search
              ? `No tasks match the filter "${search}".`
              : 'Tasks track work, effort estimates, and blocker relationships for delivery risk forecasting.'
          }
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={search ? () => setSearch('') : onOpenCreateTask}
            >
              {search ? 'Clear Filter' : '+ Create First Task'}
            </Button>
          }
        />
      ) : viewMode === 'board' ? (
        /* Real DndKit Kanban Board */
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {COLUMNS.map((col) => {
              const colTasks = filteredTasks.filter((t) => t.status === col.id);
              return (
                <DroppableKanbanColumn
                  key={col.id}
                  col={col}
                  tasks={colTasks}
                  projectKey={projectKey}
                  onSelectTask={onSelectTask}
                />
              );
            })}
          </div>

          <DragOverlay>
            {activeTask ? (
              <div className="w-72 shadow-2xl rotate-2">
                <KanbanCard task={activeTask} projectKey={projectKey} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        /* Table View */
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 overflow-hidden shadow-xs">
          <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 uppercase text-[10px] font-bold tracking-wider border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3">Task ID</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Assignee</th>
                <th className="px-4 py-3">Remaining Workdays</th>
                <th className="px-4 py-3">Due Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredTasks.map((task) => (
                <tr
                  key={task.id}
                  onClick={() => onSelectTask(task)}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-slate-100">
                    {projectKey}-{task.number}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                    {task.title}
                  </td>
                  <td className="px-4 py-3">
                    <PriorityBadge priority={task.priority} size="xs" />
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-[11px] font-semibold">
                      {task.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                    {task.assigneeName ? `@${task.assigneeName}` : 'Unassigned'}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-700 dark:text-slate-300">
                    {task.remainingEstimateWorkdays !== undefined
                      ? `${task.remainingEstimateWorkdays}d`
                      : '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-500 dark:text-slate-400">
                    {task.dueDate || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
