// Veloura Manager V2 — Notifications page
// Spec section 7.17. Grouped by today/yesterday/earlier, with priority
// colors and mark-read actions.

import { useMemo, useState } from 'react';
import { Bell, BellOff, Check, CheckCheck } from 'lucide-react';
import { clsx } from 'clsx';
import { useNotificationsSnapshot, useMarkNotificationRead, useMarkAllNotificationsRead } from '../../hooks/queries';
import type { Notification } from '../../types';
import { formatRelative } from '../../utils/format';
import { Card, EmptyState, LoadingState, ErrorState, SectionHeader, Badge } from '../../components/common/Card';
import { Button } from '../../components/common/Button';

const PRIORITY_META: Record<string, { color: string; dot: string }> = {
  High: { color: 'bg-danger-bg text-danger', dot: 'bg-danger' },
  Medium: { color: 'bg-warning-bg text-warning', dot: 'bg-warning' },
  Low: { color: 'bg-surface-alt text-text-secondary', dot: 'bg-border-strong' },
};

export function Notifications() {
  const PAGE_SIZE = 50;
  const [page, setPage] = useState(0);
  const { data: snapshot, isLoading, isError, refetch } = useNotificationsSnapshot({ notificationsLimit: PAGE_SIZE });
  const notifications = snapshot?.notifications;
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const allGrouped = useMemo(() => {
    const all = notifications ?? [];
    const today: typeof all = [];
    const yesterday: typeof all = [];
    const earlier: typeof all = [];
    const now = new Date();
    for (const n of all) {
      const d = new Date(n.created_at);
      const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays === 0) today.push(n);
      else if (diffDays === 1) yesterday.push(n);
      else earlier.push(n);
    }
    return { today, yesterday, earlier };
  }, [notifications]);

  const visibleToday = allGrouped.today.slice(0, (page + 1) * PAGE_SIZE);
  const visibleYesterday = allGrouped.yesterday.slice(0, (page + 1) * PAGE_SIZE);
  const visibleEarlier = allGrouped.earlier.slice(0, (page + 1) * PAGE_SIZE);

  const hasMore = allGrouped.today.length > visibleToday.length ||
                  allGrouped.yesterday.length > visibleYesterday.length ||
                  allGrouped.earlier.length > visibleEarlier.length;

  const loadMore = () => setPage((p) => p + 1);

  const unread = (notifications ?? []).filter((n) => !n.read).length;

  if (isLoading) return <LoadingState rows={4} />;
  if (isError) return <ErrorState message="Couldn't load notifications" onRetry={() => refetch()} />;

  const groups = [
    { label: 'Today', items: visibleToday },
    { label: 'Yesterday', items: visibleYesterday },
    { label: 'Earlier', items: visibleEarlier },
  ].filter((g) => g.items.length > 0);

  const renderItem = (n: Notification) => {
    const meta = PRIORITY_META[n.priority] ?? PRIORITY_META.Medium;
    return (
      <Card
        key={n.id}
        padding="sm"
        className={clsx('flex items-start gap-3', !n.read && 'ring-1 ring-accent/30 bg-accent/10')}
      >
        <div className={clsx('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', meta.color)}>
          <Bell className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-text-primary truncate">{n.title}</p>
            <Badge color={meta.color} dot={meta.dot}>{n.priority}</Badge>
            {!n.read && <Badge color="bg-accent/15 text-accent-muted">New</Badge>}
          </div>
          <p className="text-xs text-text-secondary mt-0.5">{n.message}</p>
          <p className="text-[11px] text-text-muted mt-1">{formatRelative(n.created_at)}</p>
        </div>
        {!n.read && (
          <button
            onClick={() => markRead.mutate(n.id)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:bg-surface-alt hover:text-success transition-colors flex-shrink-0"
            aria-label="Mark read"
          >
            <Check className="w-4 h-4" />
          </button>
        )}
      </Card>
    );
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <SectionHeader
        title="Notifications"
        subtitle={unread > 0 ? `${unread} unread` : 'All caught up'}
        action={unread > 0 && <Button size="sm" variant="outline" onClick={() => markAllRead.mutate()}><CheckCheck className="w-4 h-4" /> Mark all read</Button>}
      />

      {groups.length === 0 ? (
        <Card padding="lg">
          <EmptyState
            icon={<BellOff className="w-7 h-7" />}
            title="No notifications"
            description="Alerts about low stock, batch completion, and savings goals will appear here."
          />
        </Card>
      ) : (
        <>
          <div className="space-y-5">
            {groups.map((g) => (
              <div key={g.label}>
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">{g.label}</p>
                <div className="space-y-2">
                  {g.items.map(renderItem)}
                </div>
              </div>
            ))}
          </div>
          {hasMore && (
            <div className="text-center pt-2">
              <Button variant="outline" onClick={loadMore}>Load more notifications</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
