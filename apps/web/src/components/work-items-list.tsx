'use client';

import React, { useState, useMemo } from 'react';
import type { TaskDto, TaskStatus, OrgMemberDto } from '@teamos/contracts';
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
import { Badge, Button, EmptyState } from './ui';

interface WorkItemsListProps {
  tasks: TaskDto[];
  projectKey: string;
  members: OrgMemberDto[];
  criticalPathTaskIds?: string[];
  dependencies?: { blockerTaskId: string; blockedTaskId: string }[];
  onSelectTask: (task: TaskDto) => void;
  onOpenCreateTask: (initialStatus?: TaskStatus) => void;
  onQuickStatusChange: (taskId: string, newStatus: TaskStatus, version: number) => void;
}

type ViewMode = 'list' | 'board';
type SortField = 'number' | 'dueDate' | 'estimate' | 'status' | 'title';
type GroupBy = 'status' | 'assignee' | 'none';

interface DisplayOptions {
  showAssignee: boolean;
  showEstimate: boolean;
  showDueDate: boolean;
  showBlockers: boolean;
  showCriticalPath: boolean;
}

export function WorkItemsList({
  tasks,
  projectKey,
  members,
  criticalPathTaskIds = [],
  dependencies = [],
  onSelectTask,
  onOpenCreateTask,
  onQuickStatusChange,
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
  });

  // 5. Collapsible Group State
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

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
    assigneeFilter,
    blockedFilter,
    criticalFilter,
    blockedTaskIdsSet,
    criticalPathSet,
  ]);

  // Sort Tasks
  const sortedTasks = useMemo(() => {
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
      } else if (sortField === 'title') {
        comparison = a.title.localeCompare(b.title);
      }
      return sortAsc ? comparison : -comparison;
    });
  }, [filteredTasks, sortField, sortAsc]);

  // Active filter count
  const activeFilterCount =
    (statusFilter !== 'ALL' ? 1 : 0) +
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
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-200">
        {/* Left: Work items count */}
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-slate-900 tracking-tight">
            Work items
          </h2>
          <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200/80">
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
              className="w-full pl-8 pr-3 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
          </div>

          {/* View Mode Toggle: List | Board */}
          <div className="flex items-center rounded-lg border border-slate-200 bg-slate-100/80 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                viewMode === 'list'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
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
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
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
                  ? 'bg-blue-50 border-blue-200 text-blue-700 font-semibold'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
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
                <div className="absolute right-0 top-full mt-1.5 w-64 bg-white border border-slate-200 rounded-xl shadow-dropdown z-50 p-3 space-y-3">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                    <span className="text-xs font-bold text-slate-900">Filters</span>
                    {activeFilterCount > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setStatusFilter('ALL');
                          setAssigneeFilter('ALL');
                          setBlockedFilter('ALL');
                          setCriticalFilter('ALL');
                        }}
                        className="text-[11px] text-blue-600 hover:underline"
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
                      className="w-full text-xs p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none"
                    >
                      <option value="ALL">All Statuses</option>
                      <option value="TODO">To Do</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="DONE">Done</option>
                      <option value="CANCELLED">Cancelled</option>
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
                      className="w-full text-xs p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none"
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
                      className="w-full text-xs p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none"
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
                      className="w-full text-xs p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none"
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
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-medium transition-colors"
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
                <div className="absolute right-0 top-full mt-1.5 w-48 bg-white border border-slate-200 rounded-xl shadow-dropdown z-50 p-2 space-y-1">
                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Sort by
                  </div>
                  {[
                    { id: 'number', label: 'Task Number' },
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
                          ? 'bg-blue-50 text-blue-700 font-bold'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span>{s.label}</span>
                      {sortField === s.id && (
                        <span className="text-[10px] font-mono text-blue-600">
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
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-medium transition-colors"
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
                <div className="absolute right-0 top-full mt-1.5 w-44 bg-white border border-slate-200 rounded-xl shadow-dropdown z-50 p-2 space-y-1">
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
                          ? 'bg-blue-50 text-blue-700 font-bold'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span>{g.label}</span>
                      {groupBy === g.id && <CheckIcon className="w-3.5 h-3.5 text-blue-600" />}
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
                <div key={group.status} className="border border-slate-200/90 rounded-xl bg-white overflow-hidden shadow-xs">
                  {/* Group Header */}
                  <div className="flex items-center justify-between px-3 py-2 bg-slate-50/70 border-b border-slate-200/70">
                    <button
                      type="button"
                      onClick={() => toggleGroupCollapse(group.status)}
                      className="flex items-center gap-2 text-xs font-bold text-slate-800 hover:text-slate-900"
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
                      <span className="font-mono text-[11px] font-semibold text-slate-400 bg-white px-2 py-0.2 rounded-full border border-slate-200">
                        {groupTasks.length}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenCreateTask(group.status)}
                      className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-slate-200/70 transition-colors"
                      title={`Add task in ${group.label}`}
                    >
                      <PlusIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Group Tasks Rows */}
                  {!isCollapsed && (
                    <div className="divide-y divide-slate-100">
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
                              className="group flex items-center justify-between px-3 py-2 text-xs hover:bg-slate-50/80 transition-colors cursor-pointer gap-2"
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
                                  className="p-1 rounded hover:bg-slate-200/60 transition-colors shrink-0"
                                  title={`Status: ${task.status}. Click to advance.`}
                                >
                                  {renderStatusIcon(task.status)}
                                </button>

                                <span className="font-mono text-[11px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 shrink-0">
                                  {projectKey}-{task.number}
                                </span>

                                <span className="font-medium text-slate-900 group-hover:text-blue-600 truncate transition-colors">
                                  {task.title}
                                </span>

                                {/* Badges: Blocked & Critical Path */}
                                {displayOptions.showBlockers && isBlocked && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                                    <LockIcon className="w-2.5 h-2.5 text-amber-600" />
                                    <span>Blocked</span>
                                  </span>
                                )}

                                {displayOptions.showCriticalPath && isCritical && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 shrink-0">
                                    <FlameIcon className="w-2.5 h-2.5 text-rose-600" />
                                    <span>Critical Path</span>
                                  </span>
                                )}
                              </div>

                              {/* Right: Assignee, Estimate, Due Date */}
                              <div className="flex items-center gap-3 shrink-0 text-[11px] text-slate-500">
                                {displayOptions.showAssignee && (
                                  <div className="flex items-center gap-1.5 min-w-[90px] justify-end">
                                    {task.assigneeName ? (
                                      <span className="truncate max-w-[80px] font-medium text-slate-700">
                                        @{task.assigneeName}
                                      </span>
                                    ) : (
                                      <span className="text-slate-400">Unassigned</span>
                                    )}
                                  </div>
                                )}

                                {displayOptions.showEstimate && (
                                  <div className="min-w-[40px] text-right font-mono text-slate-700">
                                    {task.remainingEstimateWorkdays !== undefined ? (
                                      <span className="flex items-center gap-0.5 justify-end">
                                        <ClockIcon className="w-3 h-3 text-slate-400" />
                                        <span>{task.remainingEstimateWorkdays}d</span>
                                      </span>
                                    ) : (
                                      <span className="text-slate-300">—</span>
                                    )}
                                  </div>
                                )}

                                {displayOptions.showDueDate && (
                                  <div className="min-w-[85px] text-right font-mono text-slate-500">
                                    {task.dueDate ? (
                                      <span className="flex items-center gap-1 justify-end">
                                        <CalendarIcon className="w-3 h-3 text-slate-400" />
                                        <span>{task.dueDate}</span>
                                      </span>
                                    ) : (
                                      <span className="text-slate-300">—</span>
                                    )}
                                  </div>
                                )}

                                <MoreHorizontalIcon className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            /* Flat or Assignee List */
            <div className="border border-slate-200/90 rounded-xl bg-white overflow-hidden shadow-xs divide-y divide-slate-100">
              {sortedTasks.map((task) => {
                const isBlocked = blockedTaskIdsSet.has(task.id);
                const isCritical = criticalPathSet.has(task.id);

                return (
                  <div
                    key={task.id}
                    onClick={() => onSelectTask(task)}
                    className="group flex items-center justify-between px-3 py-2 text-xs hover:bg-slate-50/80 transition-colors cursor-pointer gap-2"
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
                        className="p-1 rounded hover:bg-slate-200/60 transition-colors shrink-0"
                      >
                        {renderStatusIcon(task.status)}
                      </button>

                      <span className="font-mono text-[11px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 shrink-0">
                        {projectKey}-{task.number}
                      </span>

                      <span className="font-medium text-slate-900 group-hover:text-blue-600 truncate transition-colors">
                        {task.title}
                      </span>

                      {isBlocked && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                          <LockIcon className="w-2.5 h-2.5 text-amber-600" />
                          <span>Blocked</span>
                        </span>
                      )}

                      {isCritical && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 shrink-0">
                          <FlameIcon className="w-2.5 h-2.5 text-rose-600" />
                          <span>Critical Path</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0 text-[11px] text-slate-500">
                      <span className="text-slate-600 truncate max-w-[80px]">
                        {task.assigneeName ? `@${task.assigneeName}` : 'Unassigned'}
                      </span>
                      <span className="font-mono text-slate-700">
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
        /* Board View (Kanban) */
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5">
          {[
            { id: 'TODO' as TaskStatus, label: 'To Do', color: 'bg-slate-400' },
            { id: 'IN_PROGRESS' as TaskStatus, label: 'In Progress', color: 'bg-amber-500' },
            { id: 'DONE' as TaskStatus, label: 'Done', color: 'bg-emerald-500' },
            { id: 'CANCELLED' as TaskStatus, label: 'Cancelled', color: 'bg-rose-400' },
          ].map((col) => {
            const colTasks = sortedTasks.filter((t) => t.status === col.id);

            return (
              <div
                key={col.id}
                className="bg-slate-50/80 rounded-xl p-3 border border-slate-200 flex flex-col min-h-[460px]"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200/80">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${col.color}`} />
                    <span className="text-xs font-bold text-slate-800">
                      {col.label}
                    </span>
                  </div>
                  <span className="font-mono text-[11px] font-bold text-slate-400 bg-white px-2 py-0.2 rounded-full border border-slate-200">
                    {colTasks.length}
                  </span>
                </div>

                {/* Column Task Cards */}
                <div className="space-y-2 flex-1 overflow-y-auto">
                  {colTasks.map((task) => {
                    const isBlocked = blockedTaskIdsSet.has(task.id);
                    const isCritical = criticalPathSet.has(task.id);

                    return (
                      <div
                        key={task.id}
                        onClick={() => onSelectTask(task)}
                        className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs hover:border-blue-500 hover:shadow-card transition-all cursor-pointer space-y-2 group"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                            {projectKey}-{task.number}
                          </span>
                          <div className="flex items-center gap-1">
                            {isBlocked && (
                              <span className="p-0.5 rounded bg-amber-50 text-amber-600 border border-amber-200" title="Blocked">
                                <LockIcon className="w-3 h-3" />
                              </span>
                            )}
                            {isCritical && (
                              <span className="p-0.5 rounded bg-rose-50 text-rose-600 border border-rose-200" title="Critical Path">
                                <FlameIcon className="w-3 h-3" />
                              </span>
                            )}
                          </div>
                        </div>

                        <h4 className="text-xs font-semibold text-slate-900 group-hover:text-blue-600 line-clamp-2 leading-relaxed transition-colors">
                          {task.title}
                        </h4>

                        <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 text-[10px] text-slate-400">
                          <span className="truncate max-w-[90px] text-slate-600 font-medium">
                            {task.assigneeName ? `@${task.assigneeName}` : 'Unassigned'}
                          </span>
                          {task.remainingEstimateWorkdays !== undefined && (
                            <span className="font-mono text-slate-500 flex items-center gap-0.5">
                              <ClockIcon className="w-3 h-3 text-slate-400" />
                              <span>{task.remainingEstimateWorkdays}d</span>
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

