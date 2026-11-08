'use client';

import React, { useState, useEffect } from 'react';
import type { TaskCommentDto } from '@teamos/contracts';
import { Button } from './ui';
import { MessageSquareIcon, TrashIcon, SendIcon } from './ui/icons';

interface TaskCommentsProps {
  orgId: string;
  projectId: string;
  taskId: string;
  currentUserId?: string;
  apiBaseUrl: string;
}

export function TaskComments({
  orgId,
  projectId,
  taskId,
  currentUserId,
  apiBaseUrl,
}: TaskCommentsProps) {
  const [comments, setComments] = useState<TaskCommentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadComments();
  }, [orgId, projectId, taskId]);

  async function loadComments() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/v1/orgs/${orgId}/projects/${projectId}/tasks/${taskId}/comments`,
        { credentials: 'include' },
      );
      if (res.ok) {
        const data: TaskCommentDto[] = await res.json();
        setComments(data);
      } else {
        throw new Error('Failed to load comments');
      }
    } catch (err: any) {
      setError(err?.message || 'Error loading comments.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddComment(e?: React.SyntheticEvent) {
    if (e) e.preventDefault();
    if (!newComment.trim() || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(
        `${apiBaseUrl}/api/v1/orgs/${orgId}/projects/${projectId}/tasks/${taskId}/comments`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ body: newComment.trim() }),
        },
      );

      if (res.ok) {
        const created: TaskCommentDto = await res.json();
        setComments((prev) => [...prev, created]);
        setNewComment('');
      } else {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to post comment.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to post comment.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteComment(commentId: string) {
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/v1/orgs/${orgId}/projects/${projectId}/tasks/${taskId}/comments/${commentId}`,
        {
          method: 'DELETE',
          credentials: 'include',
        },
      );
      if (res.ok) {
        setComments((prev) => prev.filter((c) => c.id !== commentId));
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.message || 'Failed to delete comment.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete comment.');
    }
  }

  return (
    <div className="space-y-4 pt-4 border-t border-slate-200/80 dark:border-slate-800">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquareIcon className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
            Discussion & Activity ({comments.length})
          </h4>
        </div>
      </div>

      {error && (
        <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg text-xs text-rose-600 dark:text-rose-400">
          {error}
        </div>
      )}

      {/* Comments List */}
      <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
        {loading ? (
          <div className="py-4 text-center text-xs text-slate-400">Loading discussion...</div>
        ) : comments.length === 0 ? (
          <div className="py-4 text-center text-xs text-slate-400 italic bg-slate-50/50 dark:bg-slate-900/50 rounded-lg border border-dashed border-slate-200 dark:border-slate-800">
            No comments yet. Start the engineering discussion below.
          </div>
        ) : (
          comments.map((comment) => {
            const isAuthor = currentUserId === comment.userId;
            const dateStr = new Date(comment.createdAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={comment.id}
                className="bg-slate-50/70 dark:bg-slate-900/70 rounded-lg p-3 border border-slate-200/70 dark:border-slate-800 space-y-1.5 group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold text-[10px] flex items-center justify-center">
                      {(comment.userDisplayName || comment.userLogin || 'U').slice(0, 1).toUpperCase()}
                    </div>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {comment.userDisplayName || `@${comment.userLogin}`}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">{dateStr}</span>
                  </div>

                  {isAuthor && (
                    <button
                      type="button"
                      onClick={() => handleDeleteComment(comment.id)}
                      className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600 transition-all p-1"
                      title="Delete comment"
                    >
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed pl-7">
                  {comment.body}
                </p>
              </div>
            );
          })
        )}
      </div>

      {/* New Comment Input */}
      <div className="space-y-2">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              handleAddComment(e);
            }
          }}
          placeholder="Leave an engineering note, PR link, or status update... (⌘+Enter to submit)"
          rows={2}
          className="w-full text-xs p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors resize-none"
        />
        <div className="flex items-center justify-end">
          <Button
            type="button"
            variant="primary"
            size="xs"
            disabled={!newComment.trim() || submitting}
            onClick={handleAddComment}
            leftIcon={<SendIcon className="w-3 h-3" />}
          >
            {submitting ? 'Posting...' : 'Comment'}
          </Button>
        </div>
      </div>
    </div>
  );
}
