import React, { useMemo, useState } from 'react';
import {
  Bell,
  CheckCheck,
  Handshake,
  Heart,
  Megaphone,
  MessageSquare,
  Radio,
  UserPlus,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { markAllNotificationsRead, markNotificationRead } from '../lib/bharatplayService';
import { formatRelativeDate } from '../lib/formatters';
import type {
  AppRoute,
  NotificationType,
  PlatformAnnouncement,
  UserNotification,
} from '../types/bharatplay';

interface NotificationsPageProps {
  notifications: UserNotification[];
  announcements: PlatformAnnouncement[];
  onNavigate: (route: AppRoute, param?: string) => void;
}

const FILTERS: { id: 'all' | NotificationType; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'subscriber', label: 'Subscribers' },
  { id: 'comment', label: 'Comments' },
  { id: 'like', label: 'Likes' },
  { id: 'collaboration', label: 'Collaborations' },
  { id: 'live', label: 'Live' },
  { id: 'announcement', label: 'Announcements' },
];

export function NotificationsPage({
  notifications,
  announcements,
  onNavigate,
}: NotificationsPageProps) {
  const { user } = useAuth();
  const [filter, setFilter] = useState<'all' | NotificationType>('all');

  const filteredNotifs = useMemo(() => {
    if (filter === 'all') return notifications;
    return notifications.filter((n) => n.type === filter);
  }, [notifications, filter]);

  const iconFor = (type: NotificationType) => {
    switch (type) {
      case 'subscriber':
        return <UserPlus className="w-4 h-4 text-[#EA580C]" />;
      case 'comment':
        return <MessageSquare className="w-4 h-4 text-sky-600" />;
      case 'like':
        return <Heart className="w-4 h-4 text-[#E11D48]" />;
      case 'collaboration':
        return <Handshake className="w-4 h-4 text-emerald-600" />;
      case 'live':
        return <Radio className="w-4 h-4 text-[#E11D48]" />;
      default:
        return <Bell className="w-4 h-4 text-[#EA580C]" />;
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold font-display text-zinc-900 dark:text-white flex items-center gap-2.5">
            <Bell className="w-6 h-6 text-[#EA580C] dark:text-[#F97316]" />
            <span>Notification Center</span>
          </h1>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
            Subscribers, comments, likes, collaboration invites, live alerts & platform announcements.
          </p>
        </div>

        {user && notifications.some((n) => !n.isRead) && (
          <button
            type="button"
            onClick={() => markAllNotificationsRead(notifications)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-100 dark:bg-[#141418] hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-900 dark:text-white"
          >
            <CheckCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Mark all read</span>
          </button>
        )}
      </div>

      {/* Platform Announcements */}
      {announcements.length > 0 && (filter === 'all' || filter === 'announcement') && (
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-[#EA580C] dark:text-[#F97316]" />
            <span>Official BharatPlay Announcements</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {announcements.map((ann) => (
              <div key={ann.id} className="p-4 rounded-xl bg-orange-50/60 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800/50 space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold uppercase tracking-wider text-[#EA580C] dark:text-[#FDBA74]">{ann.category}</span>
                  <span className="text-zinc-500 dark:text-zinc-400">{formatRelativeDate(ann.createdAt)}</span>
                </div>
                <div className="text-sm font-bold text-zinc-900 dark:text-white">{ann.title}</div>
                <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">{ann.body}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap border transition-colors ${
              filter === f.id
                ? 'bg-[#E11D48] border-[#E11D48] text-white'
                : 'bg-zinc-100 dark:bg-[#141418] border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      {!user ? (
        <div className="p-10 rounded-2xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 text-center space-y-3">
          <p className="text-sm text-zinc-700 dark:text-zinc-300">Sign in to view your personalized creator and viewer notifications.</p>
          <button
            type="button"
            onClick={() => onNavigate('login')}
            className="px-5 py-2.5 rounded-xl bg-[#E11D48] text-xs font-semibold text-white"
          >
            Sign In
          </button>
        </div>
      ) : filteredNotifs.length === 0 ? (
        <div className="p-10 rounded-2xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 text-center text-sm text-zinc-600 dark:text-zinc-400">
          No notifications in this category yet.
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredNotifs.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => {
                if (!n.isRead) markNotificationRead(n.id).catch(() => {});
                if (n.linkPath === '/studio') onNavigate('studio');
                else if (n.linkPath?.startsWith('/watch/')) onNavigate('watch', n.linkPath.replace('/watch/', ''));
                else if (n.linkPath?.startsWith('/channel/')) onNavigate('channel', n.linkPath.replace('/channel/', ''));
              }}
              className={`w-full text-left p-4 rounded-xl border transition-colors flex items-start gap-3.5 ${
                n.isRead
                  ? 'bg-white dark:bg-[#111115] border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-[#16161C]'
                  : 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/50'
              }`}
            >
              <div className="p-2.5 rounded-xl bg-zinc-100 dark:bg-[#18181D] border border-zinc-200 dark:border-zinc-700 shrink-0">
                {iconFor(n.type)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-zinc-900 dark:text-white truncate">{n.title}</span>
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400 shrink-0">{formatRelativeDate(n.createdAt)}</span>
                </div>
                <p className="text-xs text-zinc-700 dark:text-zinc-300 mt-1">{n.message}</p>
              </div>
              {!n.isRead && <span className="w-2.5 h-2.5 rounded-full bg-[#E11D48] mt-1.5 shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
