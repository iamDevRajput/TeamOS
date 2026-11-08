import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?:
    | 'default'
    | 'outline'
    | 'success'
    | 'warning'
    | 'danger'
    | 'info'
    | 'purple'
    | 'neutral';
  size?: 'xs' | 'sm' | 'md';
  dot?: boolean;
}

export function Badge({
  children,
  variant = 'default',
  size = 'sm',
  dot = false,
  className = '',
  ...props
}: BadgeProps) {
  const baseStyles =
    'inline-flex items-center font-semibold uppercase tracking-wider select-none';

  const sizeStyles = {
    xs: 'text-[9px] px-1.5 py-0.2 rounded-sm gap-1',
    sm: 'text-[10px] px-2 py-0.5 rounded-md gap-1.2',
    md: 'text-xs px-2.5 py-1 rounded-md gap-1.5',
  };

  const variantStyles = {
    default: 'bg-slate-100 text-slate-700 border border-slate-200/80',
    outline: 'bg-transparent text-slate-600 border border-slate-300',
    success: 'bg-emerald-50 text-emerald-800 border border-emerald-200/80',
    warning: 'bg-amber-50 text-amber-800 border border-amber-200/80',
    danger: 'bg-rose-50 text-rose-800 border border-rose-200/80',
    info: 'bg-blue-50 text-blue-800 border border-blue-200/80',
    purple: 'bg-purple-50 text-purple-800 border border-purple-200/80',
    neutral: 'bg-slate-900 text-white border border-slate-800',
  };

  const dotColors = {
    default: 'bg-slate-400',
    outline: 'bg-slate-400',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-rose-500',
    info: 'bg-blue-500',
    purple: 'bg-purple-500',
    neutral: 'bg-slate-300',
  };

  return (
    <span
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full inline-block ${dotColors[variant]}`}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}

export function RiskBadge({ risk }: { risk: 'LOW' | 'MEDIUM' | 'HIGH' | string }) {
  const upper = (risk || 'LOW').toUpperCase();
  if (upper === 'HIGH') {
    return (
      <Badge variant="danger" dot>
        High Risk
      </Badge>
    );
  }
  if (upper === 'MEDIUM') {
    return (
      <Badge variant="warning" dot>
        Medium Risk
      </Badge>
    );
  }
  return (
    <Badge variant="success" dot>
      Low Risk
    </Badge>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const upper = (status || 'TODO').toUpperCase();
  switch (upper) {
    case 'DONE':
      return <Badge variant="success">Done</Badge>;
    case 'IN_PROGRESS':
      return <Badge variant="info">In Progress</Badge>;
    case 'IN_REVIEW':
      return <Badge variant="purple">In Review</Badge>;
    case 'BLOCKED':
      return (
        <Badge variant="danger" dot>
          Blocked
        </Badge>
      );
    case 'TODO':
    default:
      return <Badge variant="default">To Do</Badge>;
  }
}

export function PriorityBadge({
  priority = 'MEDIUM',
  size = 'xs',
}: {
  priority?: string;
  size?: 'xs' | 'sm';
}) {
  const p = (priority || 'MEDIUM').toUpperCase();
  switch (p) {
    case 'URGENT':
      return (
        <Badge variant="danger" size={size} dot>
          Urgent
        </Badge>
      );
    case 'HIGH':
      return (
        <Badge variant="warning" size={size} dot>
          High
        </Badge>
      );
    case 'MEDIUM':
      return (
        <Badge variant="info" size={size}>
          Medium
        </Badge>
      );
    case 'LOW':
      return (
        <Badge variant="default" size={size}>
          Low
        </Badge>
      );
    default:
      return (
        <Badge variant="default" size={size}>
          {p}
        </Badge>
      );
  }
}

