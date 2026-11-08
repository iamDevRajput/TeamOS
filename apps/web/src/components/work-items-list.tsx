'use client';

import React, { useState, useMemo } from 'react';
import type { TaskDto, TaskStatus, TaskPriority, OrgMemberDto } from '@teamos/contracts';
import {
  ListIcon,
  KanbanIcon,
  SearchIcon,
  FilterIcon,
  SortAscIcon,
  LayersIcon,
  SlidersHorizontalIcon,
  PlusIcon,
  ClockIcon,
  CalendarIcon,
  LockIcon,
  FlameIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CheckIcon,
  MoreHorizontalIcon,
  CircleDottedIcon,
  CircleHalfIcon,
  CheckCircleIcon,
  XIcon,
} from './ui/icons';
import { Badge, Button, EmptyState, PriorityBadge } from './ui';
import { TaskBoard } from './task-board';

interface WorkItemsListProps {
  tasks: TaskDto[];
  projectKey: string;
  members: OrgMemberDto[];
  criticalPathTaskIds?: string[];
  dependencies?: { blockerTaskId: string; blockedTaskId: string }[];
  currentUserId?: string;
  onSelectTask: (task: TaskDto) => void;
  onOpenCreateTask: (initialStatus?: TaskStatus) => void;
  onQuickStatusChange: (taskId: string, newStatus: TaskStatus, version: number) => void;
  onInlineCreateTask?: (title: string, status: TaskStatus, priority: TaskPriority) => Promise<void>;
}

type ViewMode = 'list' | 'board';
type SortField = 'number' | 'dueDate' | 'estimate' | 'status' | 'title' | 'priority';
type GroupBy = 'status' | 'assignee' | 'none';

interface DisplayOptions {
  showAssignee: boolean;
  showEstimate: boolean;
  showDueDate: boolean;
  showBlockers: boolean;
  showCriticalPath: boolean;
  showPriority: boolean;
}

export function WorkItemsList({
  tasks,
  projectKey,
  members,
  criticalPathTaskIds = [],
  dependencies = [],
  currentUserId,
  onSelectTask,
  onOpenCreateTask,
  onQuickStatusChange,
  onInlineCreateTask,
}: WorkItemsListProps) {
  // 1. View & Search State
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [search, setSearch] = useState('');

  // 2. Filter State
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('ALL');
  const [blockedFilter, setBlockedFilter] = useState<'ALL' | 'BLOCKED' | 'UNBLOCKED'>('ALL');
  const [criticalFilter, setCriticalFilter] = useState<'ALL' | 'CRITICAL'>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');

  // 3. Sort & Group State
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [sortField, setSortField] = useState<SortField>('number');
  const [sortAsc, setSortAsc] = useState(true);

  const [groupMenuOpen, setGroupMenuOpen] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupBy>('status');

  // 4. Display Properties State
  const [displayMenuOpen, setDisplayMenuOpen] = useState(false);
  const [displayOptions, setDisplayOptions] = useState<DisplayOptions>({
    showAssignee: true,
    showEstimate: true,
    showDueDate: true,
    showBlockers: true,
    showCriticalPath: true,
    showPriority: true,
  });

  // 5. Collapsible Group State
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // 6. Inline Task Creation State
  const [inlineCreatingStatus, setInlineCreatingStatus] = useState<TaskStatus | null>(null);
  const [inlineTitle, setInlineTitle] = useState('');
  const [inlinePriority, setInlinePriority] = useState<TaskPriority>('MEDIUM');
  const [inlineSubmitting, setInlineSubmitting] = useState(false);

  async function handleInlineSubmit(status: TaskStatus) {
    if (!inlineTitle.trim() || inlineSubmitting) return;
    if (!onInlineCreateTask) {
      onOpenCreateTask(status);
      return;
    }
    setInlineSubmitting(true);
    try {
      await onInlineCreateTask(inlineTitle.trim(), status, inlinePriority);
      setInlineTitle('');
      setInlineCreatingStatus(null);
    } catch (err) {
      console.error('Failed to create task inline', err);
    } finally {
      setInlineSubmitting(false);
    }
  }

  function toggleGroupCollapse(groupId: string) {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  }

  // Pre-calculate blocked tasks based on dependencies
  const taskMap = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  const blockedTaskIdsSet = useMemo(() => {
    const set = new Set<string>();
    dependencies.forEach((dep) => {
      const blocker = taskMap.get(dep.blockerTaskId);
      if (blocker && blocker.status !== 'DONE' && blocker.status !== 'CANCELLED') {
        set.add(dep.blockedTaskId);
      }
    });
    return set;
  }, [dependencies, taskMap]);

  const criticalPathSet = useMemo(
    () => new Set(criticalPathTaskIds),
    [criticalPathTaskIds],
  );

  // Filter Tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // Search query
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchTitle = task.title.toLowerCase().includes(q);
        const matchNumber = String(task.number).includes(q);
        const matchAssignee = task.assigneeName?.toLowerCase().includes(q);
        if (!matchTitle && !matchNumber && !matchAssignee) return false;
      }

      // Status filter
      if (statusFilter !== 'ALL' && task.status !== statusFilter) {
        return false;
      }

      // Priority filter
      if (priorityFilter !== 'ALL' && task.priority !== priorityFilter) {
        return false;
      }

      // Assignee filter
      if (assigneeFilter === 'UNASSIGNED' && task.assigneeId) {
        return false;
      }
      if (
        assigneeFilter !== 'ALL' &&
        assigneeFilter !== 'UNASSIGNED' &&
        task.assigneeId !== assigneeFilter
      ) {
        return false;
      }

      // Blocked filter
      const isBlocked = blockedTaskIdsSet.has(task.id);
      if (blockedFilter === 'BLOCKED' && !isBlocked) return false;
      if (blockedFilter === 'UNBLOCKED' && isBlocked) return false;

      // Critical path filter
      const isCritical = criticalPathSet.has(task.id);
      if (criticalFilter === 'CRITICAL' && !isCritical) return false;

      return true;
    });
  }, [
    tasks,
    search,
    statusFilter,
    priorityFilter,
    assigneeFilter,
    blockedFilter,
    criticalFilter,
    blockedTaskIdsSet,
    criticalPathSet,
  ]);

  // Sort Tasks
  const sortedTasks = useMemo(() => {
    const priorityWeights: Record<string, number> = {
      URGENT: 4,
      HIGH: 3,
      MEDIUM: 2,
      LOW: 1,
    };

    return [...filteredTasks].sort((a, b) => {
      let comparison = 0;
      if (sortField === 'number') {
        comparison = a.number - b.number;
      } else if (sortField === 'dueDate') {
        comparison = (a.dueDate || '9999').localeCompare(b.dueDate || '9999');
      } else if (sortField === 'estimate') {
        comparison =
          (a.remainingEstimateWorkdays ?? 999) - (b.remainingEstimateWorkdays ?? 999);
      } else if (sortField === 'status') {
        comparison = a.status.localeCompare(b.status);
      } else if (sortField === 'priority') {
        const weightA = priorityWeights[a.priority || 'MEDIUM'] || 2;
        const weightB = priorityWeights[b.priority || 'MEDIUM'] || 2;
        comparison = weightA - weightB;
      } else if (sortField === 'title') {
        comparison = a.title.localeCompare(b.title);
      }
      return sortAsc ? comparison : -comparison;
    });
  }, [filteredTasks, sortField, sortAsc]);

  // Active filter count
  const activeFilterCount =
    (statusFilter !== 'ALL' ? 1 : 0) +
    (priorityFilter !== 'ALL' ? 1 : 0) +
    (assigneeFilter !== 'ALL' ? 1 : 0) +
    (blockedFilter !== 'ALL' ? 1 : 0) +
    (criticalFilter !== 'ALL' ? 1 : 0);

  // Status helper rendering
  function renderStatusIcon(status: TaskStatus) {
    switch (status) {
      case 'TODO':
        return <CircleDottedIcon className="w-3.5 h-3.5 text-slate-400" />;
      case 'IN_PROGRESS':
        return <CircleHalfIcon className="w-3.5 h-3.5 text-amber-500" />;
      case 'DONE':
        return <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-500" />;
      case 'CANCELLED':
        return <XIcon className="w-3.5 h-3.5 text-rose-500" />;
      default:
        return <CircleDottedIcon className="w-3.5 h-3.5 text-slate-400" />;
    }
  }

  function getNextStatus(current: TaskStatus): TaskStatus {
    switch (current) {
      case 'TODO':
        return 'IN_PROGRESS';
      case 'IN_PROGRESS':
        return 'DONE';
      case 'DONE':
        return 'TODO';
      case 'CANCELLED':
        return 'TODO';
      default:
        return 'TODO';
    }
  }

  return (
    <div className="space-y-3">
      {/* 1. Header Toolbar (Plane style) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-200 dark:border-slate-800">
        {/* Left: Work items count */}
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Work items
          </h2>
          <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700">
            {filteredTasks.length}
          </span>
        </div>

        {/* Right: Controls & Actions */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {/* Search Input */}
          <div className="relative w-44 sm:w-56">
            <SearchIcon className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search work items..."
              className="w-full pl-8 pr-3 py-1 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
          </div>

          {/* View Mode Toggle: List | Board */}
          <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100/80 dark:bg-slate-800 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-sky-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
              title="List view"
            >
              <ListIcon className="w-3.5 h-3.5" />
              <span>List</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('board')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                viewMode === 'board'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-sky-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
              title="Board view"
            >
              <KanbanIcon className="w-3.5 h-3.5" />
              <span>Board</span>
            </button>
          </div>

          {/* Filter Popover */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setFilterMenuOpen(!filterMenuOpen)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${
                activeFilterCount > 0
                  ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 font-semibold'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
              title="Filter tasks"
            >
              <FilterIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Filter</span>
              {activeFilterCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-blue-600 text-white font-mono text-[10px] flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {filterMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setFilterMenuOpen(false)}
                />
                <div className="absolute right-0 top-full mt-1.5 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-dropdown z-50 p-3 space-y-3">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100">Filters</span>
                    {activeFilterCount > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setStatusFilter('ALL');
                          setAssigneeFilter('ALL');
                          setBlockedFilter('ALL');
                          setCriticalFilter('ALL');
                        }}
                        className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        Reset all
                      </button>
                    )}
                  </div>

                  {/* Filter by Status */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Status
                    </label>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="w-full text-xs p-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none"
                    >
                      <option value="ALL">All Statuses</option>
                      <option value="TODO">To Do</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="DONE">Done</option>
                      <option value="CANCELLED">Cancelled</option>
                    </select>
                  </div>

                  {/* Filter by Priority */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Priority
                    </label>
                    <select
                      value={priorityFilter}
                      onChange={(e) => setPriorityFilter(e.target.value)}
                      className="w-full text-xs p-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none"
                    >
                      <option value="ALL">All Priorities</option>
                      <option value="URGENT">Urgent</option>
                      <option value="HIGH">High</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="LOW">Low</option>
                    </select>
                  </div>

                  {/* Filter by Assignee */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Assignee
                    </label>
                    <select
                      value={assigneeFilter}
                      onChange={(e) => setAssigneeFilter(e.target.value)}
                      className="w-full text-xs p-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none"
                    >
                      <option value="ALL">All Assignees</option>
                      <option value="UNASSIGNED">Unassigned</option>
                      {members.map((m) => (
                        <option key={m.userId} value={m.userId}>
                          {m.displayName || m.login}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Filter by Blocked */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Dependency State
                    </label>
                    <select
                      value={blockedFilter}
                      onChange={(e) => setBlockedFilter(e.target.value as any)}
                      className="w-full text-xs p-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none"
                    >
                      <option value="ALL">All Tasks</option>
                      <option value="BLOCKED">Blocked Only (Unmet Dependencies)</option>
                      <option value="UNBLOCKED">Unblocked</option>
                    </select>
                  </div>

                  {/* Filter by Critical Path */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Risk Engine
                    </label>
                    <select
                      value={criticalFilter}
                      onChange={(e) => setCriticalFilter(e.target.value as any)}
                      className="w-full text-xs p-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none"
                    >
                      <option value="ALL">All Tasks</option>
                      <option value="CRITICAL">Critical Path Tasks Only</option>
                    </select>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Sort Popover */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setSortMenuOpen(!sortMenuOpen)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 font-medium transition-colors"
              title="Sort tasks"
            >
              <SortAscIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sort</span>
            </button>

            {sortMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setSortMenuOpen(false)}
                />
                <div className="absolute right-0 top-full mt-1.5 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-dropdown z-50 p-2 space-y-1">
                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Sort by
                  </div>
                  {[
                    { id: 'number', label: 'Task Number' },
                    { id: 'priority', label: 'Priority' },
                    { id: 'dueDate', label: 'Due Date' },
                    { id: 'estimate', label: 'Remaining Workdays' },
                    { id: 'status', label: 'Status' },
                    { id: 'title', label: 'Title' },
                  ].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        if (sortField === s.id) {
                          setSortAsc(!sortAsc);
                        } else {
                          setSortField(s.id as SortField);
                          setSortAsc(true);
                        }
                        setSortMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg text-left transition-colors ${
                        sortField === s.id
                          ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span>{s.label}</span>
                      {sortField === s.id && (
                        <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400">
                          {sortAsc ? 'ASC' : 'DESC'}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Group By Popover */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setGroupMenuOpen(!groupMenuOpen)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 font-medium transition-colors"
              title="Group tasks"
            >
              <LayersIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Group</span>
            </button>

            {groupMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setGroupMenuOpen(false)}
                />
                <div className="absolute right-0 top-full mt-1.5 w-44 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-dropdown z-50 p-2 space-y-1">
                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Group by
                  </div>
                  {[
                    { id: 'status', label: 'Status' },
                    { id: 'assignee', label: 'Assignee' },
                    { id: 'none', label: 'None (Flat List)' },
                  ].map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => {
                        setGroupBy(g.id as GroupBy);
                        setGroupMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg text-left transition-colors ${
                        groupBy === g.id
                          ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span>{g.label}</span>
                      {groupBy === g.id && <CheckIcon className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Display Properties Popover */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setDisplayMenuOpen(!displayMenuOpen)}
              className="p-1 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
              title="Display properties"
            >
              <SlidersHorizontalIcon className="w-3.5 h-3.5" />
            </button>

            {displayMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setDisplayMenuOpen(false)}
                />
                <div className="absolute right-0 top-full mt-1.5 w-48 bg-white border border-slate-200 rounded-xl shadow-dropdown z-50 p-2.5 space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Display Columns
                  </div>
                  {[
                    { key: 'showAssignee', label: 'Assignee' },
                    { key: 'showPriority', label: 'Priority' },
                    { key: 'showEstimate', label: 'Estimate' },
                    { key: 'showDueDate', label: 'Due Date' },
                    { key: 'showBlockers', label: 'Blockers' },
                    { key: 'showCriticalPath', label: 'Critical Path' },
                  ].map((opt) => (
                    <label
                      key={opt.key}
                      className="flex items-center justify-between text-xs text-slate-700 cursor-pointer hover:text-slate-900"
                    >
                      <span>{opt.label}</span>
                      <input
                        type="checkbox"
                        checked={(displayOptions as any)[opt.key]}
                        onChange={(e) =>
                          setDisplayOptions((prev) => ({
                            ...prev,
                            [opt.key]: e.target.checked,
                          }))
                        }
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Add Work Item Button */}
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => onOpenCreateTask()}
            leftIcon={<PlusIcon className="w-3.5 h-3.5" />}
          >
            <span>Add work item</span>
          </Button>
        </div>
      </div>

      {/* Quick Saved Views / Presets Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        <button
          type="button"
          onClick={() => {
            setStatusFilter('ALL');
            setAssigneeFilter('ALL');
            setBlockedFilter('ALL');
            setCriticalFilter('ALL');
            setPriorityFilter('ALL');
          }}
          className={`px-2.5 py-1 rounded-lg border font-medium transition-all ${
            activeFilterCount === 0
              ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 font-bold'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          All Items ({tasks.length})
        </button>

        <button
          type="button"
          onClick={() => {
            setCriticalFilter(criticalFilter === 'CRITICAL' ? 'ALL' : 'CRITICAL');
          }}
          className={`px-2.5 py-1 rounded-lg border font-medium flex items-center gap-1 transition-all ${
            criticalFilter === 'CRITICAL'
              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-bold'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          <FlameIcon className="w-3 h-3 text-rose-500" />
          <span>Critical Path Only ({criticalPathTaskIds.length})</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setBlockedFilter(blockedFilter === 'BLOCKED' ? 'ALL' : 'BLOCKED');
          }}
          className={`px-2.5 py-1 rounded-lg border font-medium flex items-center gap-1 transition-all ${
            blockedFilter === 'BLOCKED'
              ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300 font-bold'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          <LockIcon className="w-3 h-3 text-amber-500" />
          <span>Blocked Tasks ({blockedTaskIdsSet.size})</span>
        </button>

        {currentUserId && (
          <button
            type="button"
            onClick={() => {
              setAssigneeFilter(assigneeFilter === currentUserId ? 'ALL' : currentUserId);
            }}
            className={`px-2.5 py-1 rounded-lg border font-medium flex items-center gap-1 transition-all ${
              assigneeFilter === currentUserId
                ? 'bg-sky-50 dark:bg-sky-950/40 border-sky-300 dark:border-sky-800 text-sky-700 dark:text-sky-300 font-bold'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <span>My Tasks</span>
          </button>
        )}
      </div>

      {/* 2. Main Work Items Content (List or Board) */}
      {sortedTasks.length === 0 ? (
        <EmptyState
          title="No work items found"
          description={
            search || activeFilterCount > 0
              ? 'No tasks match the active filters or search query.'
              : 'Add your first work item to track delivery dates, effort, and dependency risk.'
          }
          action={
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => onOpenCreateTask()}
              leftIcon={<PlusIcon className="w-3.5 h-3.5" />}
            >
              Add work item
            </Button>
          }
        />
      ) : viewMode === 'list' ? (
        /* Status-Grouped List View (Matching Reference Screenshot) */
        <div className="space-y-4">
          {groupBy === 'status' ? (
            /* Group by Status */
            [
              { status: 'TODO' as TaskStatus, label: 'To Do', icon: <CircleDottedIcon className="w-3.5 h-3.5 text-slate-400" /> },
              { status: 'IN_PROGRESS' as TaskStatus, label: 'In Progress', icon: <CircleHalfIcon className="w-3.5 h-3.5 text-amber-500" /> },
              { status: 'DONE' as TaskStatus, label: 'Done', icon: <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-500" /> },
              { status: 'CANCELLED' as TaskStatus, label: 'Cancelled', icon: <XIcon className="w-3.5 h-3.5 text-rose-500" /> },
            ].map((group) => {
              const groupTasks = sortedTasks.filter((t) => t.status === group.status);
              const isCollapsed = collapsedGroups[group.status] || false;

              if (groupTasks.length === 0 && (statusFilter !== 'ALL' || search)) {
                return null;
              }

              return (
                <div key={group.status} className="border border-slate-200/90 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
                  {/* Group Header */}
                  <div className="flex items-center justify-between px-3 py-2 bg-slate-50/70 dark:bg-slate-800/60 border-b border-slate-200/70 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => toggleGroupCollapse(group.status)}
                      className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 hover:text-slate-900 dark:hover:text-slate-100"
                    >
                      {isCollapsed ? (
                        <ChevronRightIcon className="w-3.5 h-3.5 text-slate-400" />
                      ) : (
                        <ChevronDownIcon className="w-3.5 h-3.5 text-slate-400" />
                      )}
                      <span className="flex items-center gap-1.5">
                        {group.icon}
                        <span>{group.label}</span>
                      </span>
                      <span className="font-mono text-[11px] font-semibold text-slate-400 bg-white dark:bg-slate-800 px-2 py-0.2 rounded-full border border-slate-200 dark:border-slate-700">
                        {groupTasks.length}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenCreateTask(group.status)}
                      className="p-1 rounded text-slate-400 hover:text-blue-600 dark:hover:text-sky-400 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors"
                      title={`Add task in ${group.label}`}
                    >
                      <PlusIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Group Tasks Rows */}
                  {!isCollapsed && (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {groupTasks.length === 0 ? (
                        <div className="px-4 py-3 text-xs text-slate-400 italic">
                          No tasks in {group.label}
                        </div>
                      ) : (
                        groupTasks.map((task) => {
                          const isBlocked = blockedTaskIdsSet.has(task.id);
                          const isCritical = criticalPathSet.has(task.id);

                          return (
                            <div
                              key={task.id}
                              onClick={() => onSelectTask(task)}
                              className="group flex items-center justify-between px-3 py-2 text-xs hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors cursor-pointer gap-2"
                            >
                              {/* Left: Status Icon, Task Key, Title */}
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onQuickStatusChange(
                                      task.id,
                                      getNextStatus(task.status),
                                      task.version,
                                    );
                                  }}
                                  className="p-1 rounded hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors shrink-0"
                                  title={`Status: ${task.status}. Click to advance.`}
                                >
                                  {renderStatusIcon(task.status)}
                                </button>

                                <span className="font-mono text-[11px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 shrink-0">
                                  {projectKey}-{task.number}
                                </span>

                                {displayOptions.showPriority && (
                                  <PriorityBadge priority={task.priority} size="xs" />
                                )}

                                <span className="font-medium text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-sky-400 truncate transition-colors">
                                  {task.title}
                                </span>

                                {/* Badges: Blocked & Critical Path */}
                                {displayOptions.showBlockers && isBlocked && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 shrink-0">
                                    <LockIcon className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
                                    <span>Blocked</span>
                                  </span>
                                )}

                                {displayOptions.showCriticalPath && isCritical && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 shrink-0">
                                    <FlameIcon className="w-2.5 h-2.5 text-rose-600 dark:text-rose-400" />
                                    <span>Critical Path</span>
                                  </span>
                                )}
                              </div>

                              {/* Right: Assignee, Estimate, Due Date */}
                              <div className="flex items-center gap-3 shrink-0 text-[11px] text-slate-500 dark:text-slate-400">
                                {displayOptions.showAssignee && (
                                  <div className="flex items-center gap-1.5 min-w-[90px] justify-end">
                                    {task.assigneeName ? (
                                      <span className="truncate max-w-[80px] font-medium text-slate-700 dark:text-slate-300">
                                        @{task.assigneeName}
                                      </span>
                                    ) : (
                                      <span className="text-slate-400">Unassigned</span>
                                    )}
                                  </div>
                                )}

                                {displayOptions.showEstimate && (
                                  <div className="min-w-[40px] text-right font-mono text-slate-700 dark:text-slate-300">
                                    {task.remainingEstimateWorkdays !== undefined ? (
                                      <span className="flex items-center gap-0.5 justify-end">
                                        <ClockIcon className="w-3 h-3 text-slate-400" />
                                        <span>{task.remainingEstimateWorkdays}d</span>
                                      </span>
                                    ) : (
                                      <span className="text-slate-300 dark:text-slate-700">—</span>
                                    )}
                                  </div>
                                )}

                                {displayOptions.showDueDate && (
                                  <div className="min-w-[85px] text-right font-mono text-slate-500 dark:text-slate-400">
                                    {task.dueDate ? (
                                      <span className="flex items-center gap-1 justify-end">
                                        <CalendarIcon className="w-3 h-3 text-slate-400" />
                                        <span>{task.dueDate}</span>
                                      </span>
                                    ) : (
                                      <span className="text-slate-300 dark:text-slate-700">—</span>
                                    )}
                                  </div>
                                )}

                                <MoreHorizontalIcon className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                            </div>
                          );
                        })
                      )}

                      {/* Inline Task Creation Row (Linear/Plane inspired quick entry) */}
                      {inlineCreatingStatus === group.status ? (
                        <div className="p-2.5 bg-slate-50/90 dark:bg-slate-800/60 border-t border-slate-200/80 dark:border-slate-700/80 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                          <input
                            type="text"
                            autoFocus
                            placeholder={`New item for ${group.label}... (Press Enter to save, Esc to cancel)`}
                            value={inlineTitle}
                            onChange={(e) => setInlineTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleInlineSubmit(group.status);
                              } else if (e.key === 'Escape') {
                                e.preventDefault();
                                setInlineCreatingStatus(null);
                                setInlineTitle('');
                              }
                            }}
                            className="flex-1 px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          <div className="flex items-center gap-1.5 justify-end">
                            <select
                              value={inlinePriority}
                              onChange={(e) => setInlinePriority(e.target.value as TaskPriority)}
                              className="text-xs px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none"
                            >
                              <option value="URGENT">🔴 Urgent</option>
                              <option value="HIGH">🟠 High</option>
                              <option value="MEDIUM">🟡 Medium</option>
                              <option value="LOW">🔵 Low</option>
                            </select>
                            <Button
                              type="button"
                              variant="primary"
                              size="sm"
                              disabled={!inlineTitle.trim() || inlineSubmitting}
                              onClick={() => handleInlineSubmit(group.status)}
                            >
                              {inlineSubmitting ? 'Saving...' : 'Add'}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setInlineCreatingStatus(null);
                                setInlineTitle('');
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setInlineCreatingStatus(group.status);
                            setInlineTitle('');
                          }}
                          className="w-full text-left px-3 py-2 text-xs text-slate-400 hover:text-blue-600 dark:hover:text-sky-400 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 flex items-center gap-1.5 border-t border-dashed border-slate-200/60 dark:border-slate-800/60 transition-colors"
                        >
                          <PlusIcon className="w-3.5 h-3.5" />
                          <span>Add work item to {group.label}...</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            /* Flat or Assignee List */
            <div className="border border-slate-200/90 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 overflow-hidden shadow-xs divide-y divide-slate-100 dark:divide-slate-800">
              {sortedTasks.map((task) => {
                const isBlocked = blockedTaskIdsSet.has(task.id);
                const isCritical = criticalPathSet.has(task.id);

                return (
                  <div
                    key={task.id}
                    onClick={() => onSelectTask(task)}
                    className="group flex items-center justify-between px-3 py-2 text-xs hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors cursor-pointer gap-2"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onQuickStatusChange(
                            task.id,
                            getNextStatus(task.status),
                            task.version,
                          );
                        }}
                        className="p-1 rounded hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors shrink-0"
                      >
                        {renderStatusIcon(task.status)}
                      </button>

                      <span className="font-mono text-[11px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 shrink-0">
                        {projectKey}-{task.number}
                      </span>

                      {displayOptions.showPriority && (
                        <PriorityBadge priority={task.priority} size="xs" />
                      )}

                      <span className="font-medium text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-sky-400 truncate transition-colors">
                        {task.title}
                      </span>

                      {isBlocked && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 shrink-0">
                          <LockIcon className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
                          <span>Blocked</span>
                        </span>
                      )}

                      {isCritical && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 shrink-0">
                          <FlameIcon className="w-2.5 h-2.5 text-rose-600 dark:text-rose-400" />
                          <span>Critical Path</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0 text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="text-slate-600 dark:text-slate-300 truncate max-w-[80px]">
                        {task.assigneeName ? `@${task.assigneeName}` : 'Unassigned'}
                      </span>
                      <span className="font-mono text-slate-700 dark:text-slate-300">
                        {task.remainingEstimateWorkdays !== undefined ? `${task.remainingEstimateWorkdays}d` : '—'}
                      </span>
                      <span className="font-mono text-slate-400">
                        {task.dueDate || '—'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Upgraded Dnd-Kit Drag-and-Drop Kanban Board */
        <TaskBoard
          tasks={filteredTasks}
          projectKey={projectKey}
          onSelectTask={onSelectTask}
          onQuickStatusChange={onQuickStatusChange}
          onOpenCreateTask={() => onOpenCreateTask()}
        />
      )}
    </div>
  );
}

