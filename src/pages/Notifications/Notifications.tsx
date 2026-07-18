// Veloura Manager V2 — Notifications page
// Spec section 7.17. Grouped by today/yesterday/earlier, with priority
// colors and mark-read actions.

import { useMemo } from 'react';
import { Bell, BellOff, Check, CheckCheck } from 'lucide-react';
import { clsx } from 'clsx';
import { useNotificationsSnapshot, useMarkNotificationRead, useMarkAllNotificationsRead } from '../../hooks/queries';
import { formatRelative } from '../../utils/format';
import { Card, EmptyState, LoadingState, ErrorState, SectionHeader, Badge } from '../../components/common/Card';
import { Button } from '../../components/common/Button';

const PRIORITY_META: Record<string, { color: string; dot: string }> = {
  High: { color: 'bg-red-50 text-red-700', dot: 'bg-red-500' },
  Medium: { color: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
  Low: { color: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
};

export function Notifications() {
  const { data: snapshot, isLoading, isError, refetch } = useNotificationsSnapshot();
  const notifications = snapshot?.notifications;
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const grouped = useMemo(() => {
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

  const unread = (notifications ?? []).filter((n) => !n.read).length;

  if (isLoading) return <LoadingState rows={4} />;
  if (isError) return <ErrorState message="Couldn't load notifications" onRetry={() => refetch()} />;

  const groups = [
    { label: 'Today', items: grouped.today },
    { label: 'Yesterday', items: grouped.yesterday },
    { label: 'Earlier', items: grouped.earlier },
  ].filter((g) => g.items.length > 0);

  const renderItem = (n: any) => {
    const meta = PRIORITY_META[n.priority] ?? PRIORITY_META.Medium;
    return (
      <Card
        key={n.id}
        padding="sm"
        className={clsx('flex items-start gap-3', !n.read && 'ring-1 ring-plum-200 bg-plum-50/30')}
      >
        <div className={clsx('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', meta.color)}>
          <Bell className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-slate-900 truncate">{n.title}</p>
            <Badge color={meta.color} dot={meta.dot}>{n.priority}</Badge>
            {!n.read && <Badge color="bg-plum-100 text-plum-700">New</Badge>}
          </div>
          <p className="text-xs text-slate-600 mt-0.5">{n.message}</p>
          <p className="text-[11px] text-slate-400 mt-1">{formatRelative(n.created_at)}</p>
        </div>
        {!n.read && (
          <button
            onClick={() => markRead.mutate(n.id)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-emerald-600 transition-colors flex-shrink-0"
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
        <div className="space-y-5">
          {groups.map((g) => (
            <div key={g.label}>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{g.label}</p>
              <div className="space-y-2">
                {g.items.map(renderItem)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
