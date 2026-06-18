'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { timeAgo, truncateAddress, cn } from '@/lib/utils';
import { useApp } from '@/components/Providers';
import { useTranslation } from '@/i18n/I18nProvider';
import type { Comment } from '@/types';

interface CommentSectionProps {
  marketId: string;
}

export function CommentSection({ marketId }: CommentSectionProps) {
  const { user } = useApp();
  const { t, locale } = useTranslation();

  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // 评论输入
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // 回复状态: { commentId, username } 或 null
  const [replyTo, setReplyTo] = useState<{ id: string; username: string } | null>(null);

  // 删除确认
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // 点赞中的评论 IDs
  const [likingIds, setLikingIds] = useState<Set<string>>(new Set());

  const fetchComments = useCallback(async (pageNum: number, append = false) => {
    try {
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);

      const res = await api.getComments(marketId, pageNum, 20) as any;
      const newComments: Comment[] = res?.data?.comments || res?.comments || [];

      if (append) {
        setComments(prev => [...prev, ...newComments]);
      } else {
        setComments(newComments);
      }

      const total = res?.data?.total ?? res?.total ?? 0;
      const perPage = 20;
      setHasMore((pageNum * perPage) < total);
    } catch {
      setError(t('comments.serverError'));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [marketId, t]);

  useEffect(() => {
    setPage(1);
    fetchComments(1);
  }, [marketId, fetchComments]);

  const handleSubmit = async () => {
    const trimmed = content.trim();
    if (!trimmed) {
      setSubmitError(t('comments.contentRequired'));
      return;
    }
    if (trimmed.length > 2000) return;

    if (!user) {
      setSubmitError(t('comments.loginFirst'));
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      const res = await api.createComment({
        marketId,
        content: trimmed,
        parentId: replyTo?.id || null,
      }) as any;

      const newComment: Comment = res?.data || res;
      if (replyTo) {
        // 作为回复添加到父评论的 replies
        setComments(prev => prev.map(c =>
          c.id === replyTo.id
            ? { ...c, replies: [...(c.replies || []), newComment] }
            : c
        ));
      } else {
        setComments(prev => [newComment, ...prev]);
      }

      setContent('');
      setReplyTo(null);
    } catch {
      setSubmitError(t('comments.serverError'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleLike = async (commentId: string) => {
    if (likingIds.has(commentId)) return;

    setLikingIds(prev => new Set(prev).add(commentId));
    try {
      await api.likeComment(commentId);

      const updateLike = (list: Comment[]): Comment[] =>
        list.map(c => {
          if (c.id === commentId) return { ...c, likes: c.likes + 1 };
          if (c.replies) return { ...c, replies: updateLike(c.replies) };
          return c;
        });

      setComments(prev => updateLike(prev));
    } catch {
      // 静默失败
    } finally {
      setLikingIds(prev => {
        const next = new Set(prev);
        next.delete(commentId);
        return next;
      });
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      await api.deleteComment(commentId);

      const removeComment = (list: Comment[]): Comment[] =>
        list
          .filter(c => c.id !== commentId)
          .map(c => c.replies ? { ...c, replies: removeComment(c.replies) } : c);

      setComments(prev => removeComment(prev));
      setDeletingId(null);
    } catch {
      // 静默失败
    }
  };

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchComments(nextPage, true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // 渲染单条评论
  const renderComment = (comment: Comment, isReply = false) => {
    const isOwner = user?.id === comment.userId;
    const showDelete = deletingId === comment.id;

    return (
      <div
        key={comment.id}
        className={cn(
          'group',
          isReply ? 'ml-10 mt-3' : 'border-t border-[var(--border-light)] first:border-t-0 pt-4 first:pt-0'
        )}
      >
        <div className="flex gap-3">
          {/* 头像 */}
          <div className="w-8 h-8 rounded-full bg-[var(--bg-card-alt)] border border-[var(--border)] flex items-center justify-center shrink-0 text-xs font-semibold text-[var(--text-secondary)] uppercase select-none">
            {(comment.username || comment.userId || 'U').slice(0, 2)}
          </div>

          <div className="flex-1 min-w-0">
            {/* 头部: 用户名 + 时间 */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-[var(--text-primary)]">
                {comment.username || truncateAddress(comment.userId)}
              </span>
              <span className="text-xs text-[var(--text-muted)]">
                {timeAgo(comment.createdAt, locale as 'zh' | 'en')}
              </span>
            </div>

            {/* 内容 */}
            <p className="mt-1 text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap break-words">
              {comment.content}
            </p>

            {/* 操作栏 */}
            <div className="flex items-center gap-4 mt-2">
              {/* 点赞 */}
              <button
                onClick={() => handleLike(comment.id)}
                disabled={likingIds.has(comment.id) || !user}
                className={cn(
                  'flex items-center gap-1 text-xs transition-colors duration-150',
                  'text-[var(--text-muted)] hover:text-[var(--accent-coral)]',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 22V11M2 13v7a2 2 0 0 0 2 2h12.4a2 2 0 0 0 1.94-1.52l2.1-8.4A2 2 0 0 0 18.5 10H15V5a3 3 0 0 0-6 0v2" />
                </svg>
                {comment.likes > 0 && (
                  <span>{comment.likes}</span>
                )}
                <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                  {t('comments.like')}
                </span>
              </button>

              {/* 回复 */}
              {!isReply && (
                <button
                  onClick={() => setReplyTo({ id: comment.id, username: comment.username || truncateAddress(comment.userId) })}
                  className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--accent-blue)] transition-colors duration-150"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 17 4 12 9 7" />
                    <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
                  </svg>
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                    {t('comments.reply')}
                  </span>
                </button>
              )}

              {/* 删除 (仅自己的评论) */}
              {isOwner && (
                showDelete ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDelete(comment.id)}
                      className="text-xs text-[var(--red)] hover:underline"
                    >
                      {t('comments.deleteConfirm')}
                    </button>
                    <button
                      onClick={() => setDeletingId(null)}
                      className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                    >
                      {locale === 'zh' ? '取消' : 'Cancel'}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeletingId(comment.id)}
                    className="text-xs text-[var(--text-muted)] hover:text-[var(--red)] transition-colors duration-150"
                  >
                    {t('comments.delete')}
                  </button>
                )
              )}
            </div>

            {/* 回复列表 */}
            {!isReply && comment.replies && comment.replies.length > 0 && (
              <div className="mt-1">
                {comment.replies.map(reply => renderComment(reply, true))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full">
      {/* 标题 */}
      <div className="flex items-center gap-2 mb-4">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-secondary)]">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <h3 className="text-base font-semibold text-[var(--text-primary)]">
          {t('comments.title')}
        </h3>
        {!loading && comments.length > 0 && (
          <span className="text-xs text-[var(--text-muted)]">
            ({comments.length})
          </span>
        )}
      </div>

      {/* 评论输入框 */}
      <div className={cn(
        'rounded-xl border p-4 transition-colors duration-200',
        replyTo
          ? 'border-[var(--accent-blue)] bg-[var(--bg-card-alt)]'
          : 'border-[var(--border)] bg-[var(--bg-card)]'
      )}>
        {replyTo && (
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[var(--accent-blue)]">
              {t('comments.replyingTo').replace('{name}', replyTo.username)}
            </span>
            <button
              onClick={() => setReplyTo(null)}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
            >
              {t('comments.cancelReply')}
            </button>
          </div>
        )}

        <textarea
          value={content}
          onChange={e => {
            setContent(e.target.value);
            setSubmitError('');
          }}
          onKeyDown={handleKeyDown}
          placeholder={t('comments.write')}
          maxLength={2000}
          rows={3}
          disabled={!user}
          className={cn(
            'w-full resize-none bg-transparent text-sm text-[var(--text-primary)]',
            'placeholder:text-[var(--text-muted)] outline-none',
            'disabled:cursor-not-allowed disabled:opacity-50'
          )}
        />

        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-3">
            <span className={cn(
              'text-xs',
              content.length > 1800
                ? 'text-[var(--accent-amber)]'
                : 'text-[var(--text-muted)]'
            )}>
              {content.length}/2000
            </span>
            {submitError && (
              <span className="text-xs text-[var(--red)]">{submitError}</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!user && (
              <span className="text-xs text-[var(--text-muted)]">
                {t('comments.loginFirst')}
              </span>
            )}
            <button
              onClick={handleSubmit}
              disabled={submitting || !content.trim() || !user}
              className={cn(
                'px-4 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
                'bg-[var(--accent-blue)] text-white',
                'hover:bg-[var(--accent-blue-hover)]',
                'disabled:opacity-40 disabled:cursor-not-allowed',
                'active:scale-95'
              )}
            >
              {submitting ? (
                <span className="flex items-center gap-1.5">
                  <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                    <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
                  </svg>
                  {t('comments.submitting')}
                </span>
              ) : (
                t('comments.submit')
              )}
            </button>
          </div>
        </div>

        <p className="mt-1.5 text-[11px] text-[var(--text-muted)]">
          {locale === 'zh' ? '⌘ + Enter 发布' : '⌘ + Enter to post'}
        </p>
      </div>

      {/* 评论列表 */}
      <div className="mt-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <svg className="animate-spin w-5 h-5 text-[var(--text-muted)]" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
              <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
            </svg>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <p className="text-sm text-[var(--red)]">{error}</p>
            <button
              onClick={() => fetchComments(1)}
              className="text-xs text-[var(--accent-blue)] hover:underline"
            >
              {locale === 'zh' ? '重试' : 'Retry'}
            </button>
          </div>
        ) : comments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-muted)] opacity-40">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <p className="text-sm text-[var(--text-muted)]">{t('comments.noComments')}</p>
            <p className="text-xs text-[var(--text-muted)] opacity-60">{t('comments.noCommentsHint')}</p>
          </div>
        ) : (
          <div>
            {comments.map(comment => renderComment(comment))}

            {/* 加载更多 */}
            {hasMore && (
              <div className="flex justify-center pt-4">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className={cn(
                    'px-4 py-2 rounded-lg text-xs font-medium transition-all duration-200',
                    'border border-[var(--border)] text-[var(--text-secondary)]',
                    'hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  {loadingMore ? (
                    <span className="flex items-center gap-1.5">
                      <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                        <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
                      </svg>
                      {t('home.loadingMore')}
                    </span>
                  ) : (
                    t('comments.loadMore')
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
