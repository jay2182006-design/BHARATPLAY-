import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  Ban,
  CheckCircle2,
  Crown,
  Eye,
  FileWarning,
  Film,
  KeyRound,
  Lock,
  Megaphone,
  RefreshCw,
  RotateCcw,
  ScrollText,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  Tv,
  UserCheck,
  UserCog,
  Users,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import { MediaImage } from '../components/MediaImage';
import { CeoConfirmDialog, type PendingCeoAction } from '../components/CeoConfirmDialog';
import {
  executeCeoAnnouncementAction,
  executeCeoChannelAction,
  executeCeoReportAction,
  executeCeoUserAction,
  executeCeoVideoAction,
  fetchCeoOverview,
} from '../lib/ceoService';
import { formatCount } from '../lib/formatters';
import type {
  AppRoute,
  CeoEnrichedUser,
  CeoOverviewResponse,
  VideoItem,
} from '../types/bharatplay';

interface CeoCommandCenterPageProps {
  onOpenChannel: (channelId: string) => void;
  onWatchVideo: (video: VideoItem) => void;
  onNavigate: (route: AppRoute) => void;
}

type CeoTab =
  | 'overview'
  | 'channels'
  | 'videos'
  | 'users'
  | 'verification'
  | 'announcements'
  | 'audit';

export function CeoCommandCenterPage({
  onOpenChannel,
  onWatchVideo,
  onNavigate,
}: CeoCommandCenterPageProps) {
  const { user, isCeo, getIdToken, reauthenticateCeo } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<CeoTab>('overview');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [data, setData] = useState<CeoOverviewResponse | null>(null);
  const [lastVerifiedAt, setLastVerifiedAt] = useState<number>(0);

  // Search & Filter states
  const [channelQuery, setChannelQuery] = useState('');
  const [channelStatusFilter, setChannelStatusFilter] = useState<'all' | 'active' | 'suspended' | 'deleted'>('all');
  const [selectedChannel, setSelectedChannel] = useState<CeoEnrichedUser | null>(null);

  const [videoQuery, setVideoQuery] = useState('');
  const [videoStatusFilter, setVideoStatusFilter] = useState<'all' | 'published' | 'flagged' | 'removed'>('all');
  const [selectedVideo, setSelectedVideo] = useState<VideoItem | null>(null);

  const [userQuery, setUserQuery] = useState('');
  const [userFilter, setUserFilter] = useState<'all' | 'active' | 'suspended' | 'deleted'>('all');
  const [selectedUser, setSelectedUser] = useState<CeoEnrichedUser | null>(null);

  const [verifyQuery, setVerifyQuery] = useState('');

  const [auditQuery, setAuditQuery] = useState('');
  const [auditTypeFilter, setAuditTypeFilter] = useState<string>('all');

  // Announcement form
  const [annTitle, setAnnTitle] = useState('');
  const [annCategory, setAnnCategory] = useState<'feature' | 'league' | 'policy' | 'event'>('policy');
  const [annBody, setAnnBody] = useState('');
  const [publishingAnn, setPublishingAnn] = useState(false);

  // Confirmation modal state
  const [pendingAction, setPendingAction] = useState<PendingCeoAction | null>(null);
  const [pendingRequiresStepUp, setPendingRequiresStepUp] = useState(false);

  const loadTelemetry = useCallback(async () => {
    if (!user || !isCeo) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError('');
    try {
      const token = await getIdToken();
      if (!token) throw new Error('Authentication token unavailable.');
      const overview = await fetchCeoOverview(token);
      setData(overview);
    } catch (err: any) {
      setLoadError(err?.message || 'Unauthorized or unable to fetch CEO telemetry.');
    } finally {
      setLoading(false);
    }
  }, [user, isCeo, getIdToken]);

  useEffect(() => {
    loadTelemetry();
  }, [loadTelemetry]);

  const handleManualReauth = async () => {
    try {
      await reauthenticateCeo();
      setLastVerifiedAt(Date.now());
      showToast('CEO step-up identity verified cleanly.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Re-authentication cancelled or failed.', 'error');
    }
  };

  const runWithToken = async (
    freshToken: string | undefined,
    fn: (token: string) => Promise<void>,
    successMsg: string
  ) => {
    const token = freshToken || (await getIdToken());
    if (!token) throw new Error('Authentication required');
    await fn(token);
    showToast(successMsg, 'success');
    await loadTelemetry();
  };

  // Strict server-independent UI denial gate for non-CEO accounts
  if (!user || !isCeo) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="rounded-2xl bg-[#0D0D10] border border-red-900/60 p-8 space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-red-950/60 border border-red-800/50 flex items-center justify-center text-red-400">
            <Lock className="w-7 h-7" />
          </div>
          <div className="text-xs font-semibold uppercase tracking-widest text-red-400">
            403 · Unauthorized Access
          </div>
          <h1 className="text-2xl font-display font-bold text-white">
            BHARATPLAY CEO Command Center Restricted
          </h1>
          <p className="text-sm text-zinc-400 leading-relaxed">
            This executive console is exclusively restricted to the verified Platform CEO account. Viewers, creators, moderators, and standard administrators do not have clearance to access CEO routes or APIs.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => onNavigate('home')}
              className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-sm font-semibold text-white"
            >
              Return to BharatPlay Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  const metrics = data?.metrics;
  const allUsers = data?.users || [];
  const allVideos = data?.videos || [];
  const allReports = data?.reports || [];
  const allAnnouncements = data?.announcements || [];
  const allAuditLogs = data?.auditLogs || [];

  const channelsList = useMemo(() => {
    const q = channelQuery.trim().toLowerCase();
    return allUsers
      .filter((u) => u.isCreator || u.channelStatus === 'suspended' || u.channelStatus === 'deleted')
      .filter((u) => {
        if (channelStatusFilter !== 'all' && (u.channelStatus || 'active') !== channelStatusFilter) {
          return false;
        }
        if (!q) return true;
        return (
          u.displayName.toLowerCase().includes(q) ||
          u.handle.toLowerCase().includes(q) ||
          u.uid.toLowerCase().includes(q) ||
          (u.email || '').toLowerCase().includes(q)
        );
      });
  }, [allUsers, channelQuery, channelStatusFilter]);

  const filteredVideos = useMemo(() => {
    const q = videoQuery.trim().toLowerCase();
    return allVideos.filter((v) => {
      if (videoStatusFilter !== 'all' && v.status !== videoStatusFilter) return false;
      if (!q) return true;
      return (
        v.title.toLowerCase().includes(q) ||
        v.id.toLowerCase().includes(q) ||
        v.creatorName.toLowerCase().includes(q) ||
        v.creatorId.toLowerCase().includes(q)
      );
    });
  }, [allVideos, videoQuery, videoStatusFilter]);

  const filteredUsers = useMemo(() => {
    const q = userQuery.trim().toLowerCase();
    return allUsers.filter((u) => {
      const st = u.accountStatus || 'active';
      if (userFilter !== 'all' && st !== userFilter) return false;
      if (!q) return true;
      return (
        u.displayName.toLowerCase().includes(q) ||
        u.handle.toLowerCase().includes(q) ||
        u.uid.toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q)
      );
    });
  }, [allUsers, userQuery, userFilter]);

  const filteredCreatorsForVerify = useMemo(() => {
    const q = verifyQuery.trim().toLowerCase();
    return allUsers
      .filter((u) => u.isCreator && u.channelStatus !== 'deleted' && u.accountStatus !== 'deleted')
      .filter((u) => {
        if (!q) return true;
        return (
          u.displayName.toLowerCase().includes(q) ||
          u.handle.toLowerCase().includes(q) ||
          u.uid.toLowerCase().includes(q)
        );
      });
  }, [allUsers, verifyQuery]);

  const filteredAuditLogs = useMemo(() => {
    const q = auditQuery.trim().toLowerCase();
    return allAuditLogs.filter((log) => {
      if (auditTypeFilter !== 'all' && log.targetType !== auditTypeFilter) return false;
      if (!q) return true;
      return (
        log.action.toLowerCase().includes(q) ||
        log.targetId.toLowerCase().includes(q) ||
        (log.targetLabel || '').toLowerCase().includes(q) ||
        log.reason.toLowerCase().includes(q)
      );
    });
  }, [allAuditLogs, auditQuery, auditTypeFilter]);

  const videoReports = useMemo(
    () => allReports.filter((r) => r.targetType === 'video'),
    [allReports]
  );
  const userReports = useMemo(
    () => allReports.filter((r) => r.targetType === 'user'),
    [allReports]
  );

  const openConfirm = (actionConfig: PendingCeoAction, stepUp = false) => {
    setPendingRequiresStepUp(stepUp);
    setPendingAction(actionConfig);
  };

  const formatTimestamp = (ts: any) => {
    if (!ts) return '—';
    const d = ts?.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handlePublishAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (annTitle.trim().length < 2 || annBody.trim().length < 3) {
      showToast('Provide both an announcement title and message.', 'error');
      return;
    }
    setPublishingAnn(true);
    try {
      const token = await getIdToken();
      if (!token) throw new Error('Authentication required');
      await executeCeoAnnouncementAction(token, {
        action: 'publish',
        title: annTitle.trim(),
        body: annBody.trim(),
        category: annCategory,
      });
      setAnnTitle('');
      setAnnBody('');
      showToast('Platform-wide CEO announcement published.', 'success');
      await loadTelemetry();
    } catch (err: any) {
      if (err?.code === 'CEO_REAUTH_REQUIRED') {
        try {
          const fresh = await reauthenticateCeo();
          await executeCeoAnnouncementAction(fresh, {
            action: 'publish',
            title: annTitle.trim(),
            body: annBody.trim(),
            category: annCategory,
          });
          setAnnTitle('');
          setAnnBody('');
          showToast('Platform-wide CEO announcement published.', 'success');
          await loadTelemetry();
        } catch (reErr: any) {
          showToast(reErr?.message || 'Re-authentication failed.', 'error');
        }
      } else {
        showToast(err?.message || 'Unable to publish announcement.', 'error');
      }
    } finally {
      setPublishingAnn(false);
    }
  };

  const tabs: { id: CeoTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'overview', label: 'Command Overview', icon: <Activity className="w-4 h-4" /> },
    { id: 'channels', label: 'Channels', icon: <Tv className="w-4 h-4" /> },
    {
      id: 'videos',
      label: 'Videos',
      icon: <Film className="w-4 h-4" />,
      badge: videoReports.filter((r) => r.status === 'pending').length || undefined,
    },
    {
      id: 'users',
      label: 'Users & Roles',
      icon: <Users className="w-4 h-4" />,
      badge: userReports.filter((r) => r.status === 'pending').length || undefined,
    },
    { id: 'verification', label: 'Verification & Boost', icon: <BadgeCheck className="w-4 h-4" /> },
    { id: 'announcements', label: 'Announcements', icon: <Megaphone className="w-4 h-4" /> },
    { id: 'audit', label: 'CEO Audit Logs', icon: <ScrollText className="w-4 h-4" /> },
  ];

  return (
    <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-6 space-y-6">
      {/* Executive Command Header */}
      <section className="rounded-2xl bg-gradient-to-br from-[#2B080A] via-[#12090B] to-[#09090B] border border-red-900/50 p-5 md:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#F97316]">
              <Crown className="w-4 h-4 text-[#F97316]" />
              <span>BHARATPLAY Executive Governance · Clearance Verified</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-display font-extrabold tracking-tight text-white">
              BHARATPLAY CEO Command Center
            </h1>
            <p className="text-sm text-zinc-300 max-w-2xl">
              Platform-wide governance across channels, videos, user accounts, creator verification, announcements, and permanent audit logs.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleManualReauth}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-950/70 hover:bg-red-900/70 border border-red-800/60 text-xs font-semibold text-red-100 whitespace-nowrap transition-colors"
            >
              <KeyRound className="w-3.5 h-3.5 text-[#F97316]" />
              <span>
                {lastVerifiedAt ? 'Step-Up Re-Verified' : 'Verify Sensitive Session'}
              </span>
            </button>
            <button
              type="button"
              onClick={loadTelemetry}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-xs font-bold text-white whitespace-nowrap transition-colors disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Telemetry</span>
            </button>
          </div>
        </div>
      </section>

      {loadError && (
        <div className="rounded-xl bg-red-950/50 border border-red-800/60 px-4 py-3 text-sm text-red-200 flex items-center justify-between gap-3">
          <span>{loadError}</span>
          <button
            type="button"
            onClick={loadTelemetry}
            className="px-3 py-1.5 rounded-lg bg-red-800 hover:bg-red-700 text-xs font-semibold text-white whitespace-nowrap"
          >
            Retry
          </button>
        </div>
      )}

      {/* KPI Command Strip */}
      <section className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {[
          { label: 'Registered Users', value: metrics?.totalUsers ?? 0, accent: 'text-white' },
          { label: 'Total Creators', value: metrics?.totalCreators ?? 0, accent: 'text-[#F97316]' },
          { label: 'Total Channels', value: metrics?.totalChannels ?? 0, accent: 'text-white' },
          { label: 'Uploaded Videos', value: metrics?.totalVideos ?? 0, accent: 'text-white' },
          { label: 'Platform Views', value: formatCount(metrics?.totalPlatformViews ?? 0), accent: 'text-[#F97316]' },
          { label: 'Active Users', value: metrics?.activeUsers ?? 0, accent: 'text-emerald-400' },
          { label: 'Suspended Accounts', value: metrics?.suspendedAccounts ?? 0, accent: 'text-red-400' },
          { label: 'Pending Reports', value: metrics?.pendingReports ?? 0, accent: 'text-amber-400' },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl bg-[#111115] border border-red-900/30 px-3.5 py-3 space-y-1"
          >
            <div className="text-[11px] font-medium text-zinc-400 truncate">{kpi.label}</div>
            <div className={`text-xl font-display font-bold tabular-nums ${kpi.accent}`}>
              {loading && !data ? '—' : kpi.value}
            </div>
          </div>
        ))}
      </section>

      {/* Enterprise Navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar border-b border-white/10 pb-2">
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                active
                  ? 'bg-gradient-to-r from-[#B91C1C] to-[#EA580C] text-white shadow-sm'
                  : 'bg-[#111115] text-zinc-400 hover:text-white hover:bg-white/5 border border-white/10'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.badge ? (
                <span className="px-1.5 py-0.5 rounded-md bg-black/40 text-[10px] font-bold text-amber-300 tabular-nums">
                  {tab.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* TAB 1: COMMAND OVERVIEW & RECENT PLATFORM ACTIVITY */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Recent CEO & Governance Activity */}
          <div className="lg:col-span-2 rounded-2xl bg-[#111115] border border-white/10 overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-white">Recent Platform & CEO Activity</h2>
                <p className="text-xs text-zinc-400">
                  Chronological record of governance actions, moderation events, and announcements
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('audit')}
                className="text-xs font-semibold text-[#F97316] hover:underline whitespace-nowrap"
              >
                Full Audit Ledger
              </button>
            </div>
            <div className="divide-y divide-white/5">
              {allAuditLogs.length === 0 ? (
                <div className="p-8 text-center text-sm text-zinc-400">
                  No CEO governance actions recorded yet. Every channel, video, user, verification, and announcement action is logged automatically here.
                </div>
              ) : (
                allAuditLogs.slice(0, 8).map((log) => (
                  <div key={log.id} className="px-5 py-3.5 flex items-start justify-between gap-4 hover:bg-white/[0.02]">
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2 text-xs font-semibold text-white">
                        <span className="font-mono text-[#F97316]">{log.action}</span>
                        <span className="text-zinc-500">·</span>
                        <span className="truncate">{log.targetLabel || log.targetId}</span>
                      </div>
                      <p className="text-xs text-zinc-400 line-clamp-1">{log.reason}</p>
                    </div>
                    <div className="text-right shrink-0 space-y-0.5">
                      <div
                        className={`text-[11px] font-semibold ${
                          log.status === 'success'
                            ? 'text-emerald-400'
                            : log.status === 'blocked'
                            ? 'text-amber-400'
                            : 'text-red-400'
                        }`}
                      >
                        {log.status.toUpperCase()}
                      </div>
                      <div className="text-[11px] font-mono text-zinc-500 tabular-nums">
                        {formatTimestamp(log.createdAt)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Platform Health & Quick Actions */}
          <div className="space-y-4">
            <div className="rounded-2xl bg-[#111115] border border-red-900/35 p-5 space-y-3">
              <h2 className="text-base font-bold text-white">Catalog & Governance Snapshot</h2>
              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                  <span className="text-zinc-400">Published Videos</span>
                  <span className="font-mono font-bold text-white tabular-nums">{metrics?.publishedVideos ?? 0}</span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                  <span className="text-zinc-400">Soft-Removed (Recoverable)</span>
                  <span className="font-mono font-bold text-amber-400 tabular-nums">{metrics?.removedVideos ?? 0}</span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                  <span className="text-zinc-400">Suspended Channels</span>
                  <span className="font-mono font-bold text-red-400 tabular-nums">{metrics?.suspendedChannels ?? 0}</span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                  <span className="text-zinc-400">Live Streams Active</span>
                  <span className="font-mono font-bold text-emerald-400 tabular-nums">{metrics?.liveStreamsActive ?? 0}</span>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-zinc-400">Active Challenges / League</span>
                  <span className="font-mono font-bold text-[#F97316] tabular-nums">
                    {(metrics?.activeChallenges ?? 0)} / {(metrics?.activeCompetitions ?? 0)}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-[#111115] border border-white/10 p-5 space-y-3">
              <h2 className="text-base font-bold text-white">Safety & Recovery Policy</h2>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Channel removal and video moderation use soft deletion initially so accidental removals can be restored cleanly. Permanent deletion requires explicit confirmation, reason, and fresh CEO authentication.
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('channels')}
                  className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-white text-center"
                >
                  Manage Channels
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('announcements')}
                  className="px-3 py-2 rounded-xl bg-[#E11D48]/20 hover:bg-[#E11D48]/30 border border-[#E11D48]/40 text-xs font-semibold text-rose-200 text-center"
                >
                  Broadcast Notice
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CHANNEL MANAGEMENT */}
      {activeTab === 'channels' && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={channelQuery}
                onChange={(e) => setChannelQuery(e.target.value)}
                placeholder="Search channel by name, @handle, or channel ID..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#111115] border border-white/15 focus:border-[#F97316] text-sm text-white placeholder-zinc-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1.5 bg-[#111115] p-1 rounded-xl border border-white/10">
              {(['all', 'active', 'suspended', 'deleted'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setChannelStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize whitespace-nowrap ${
                    channelStatusFilter === st
                      ? 'bg-[#DC2626] text-white'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            <div className="xl:col-span-2 rounded-2xl bg-[#111115] border border-white/10 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-black/40 border-b border-white/10 text-zinc-400">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Channel</th>
                      <th className="py-3 px-4 font-semibold">Status</th>
                      <th className="py-3 px-4 font-semibold text-right">Subscribers</th>
                      <th className="py-3 px-4 font-semibold text-right">Views</th>
                      <th className="py-3 px-4 font-semibold text-right">Governance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {channelsList.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-10 text-center text-zinc-400">
                          No channels match your search filter.
                        </td>
                      </tr>
                    ) : (
                      channelsList.map((ch) => {
                        const cStatus = ch.channelStatus || 'active';
                        const isSelf = ch.uid === user.uid;
                        return (
                          <tr
                            key={ch.uid}
                            onClick={() => setSelectedChannel(ch)}
                            className={`cursor-pointer hover:bg-white/[0.03] ${
                              selectedChannel?.uid === ch.uid ? 'bg-red-950/20' : ''
                            }`}
                          >
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <MediaImage
                                  src={ch.avatarUrl}
                                  alt={ch.displayName}
                                  className="w-9 h-9 rounded-lg object-cover shrink-0"
                                />
                                <div className="min-w-0">
                                  <div className="font-semibold text-white flex items-center gap-1.5 truncate">
                                    <span className="truncate">{ch.displayName}</span>
                                    {ch.isVerified && <BadgeCheck className="w-3.5 h-3.5 text-[#F97316] shrink-0" />}
                                  </div>
                                  <div className="text-[11px] font-mono text-zinc-500 truncate">
                                    @{ch.handle} · {ch.uid}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`text-xs font-semibold capitalize ${
                                  cStatus === 'active'
                                    ? 'text-emerald-400'
                                    : cStatus === 'suspended'
                                    ? 'text-amber-400'
                                    : 'text-red-400'
                                }`}
                              >
                                {cStatus}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-mono tabular-nums text-zinc-200">
                              {formatCount(ch.subscribersCount || 0)}
                            </td>
                            <td className="py-3 px-4 text-right font-mono tabular-nums text-zinc-200">
                              {formatCount(ch.totalViews || 0)}
                            </td>
                            <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="inline-flex items-center gap-1.5">
                                {cStatus !== 'active' ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openConfirm({
                                        title: `Restore Channel: ${ch.displayName}`,
                                        description: 'Restore this channel back to active public creator standing.',
                                        confirmLabel: 'Restore Channel',
                                        dangerTone: 'orange',
                                        defaultReason: 'Appeal approved / channel restored by CEO',
                                        onConfirm: async ({ reason, freshToken }) =>
                                          runWithToken(
                                            freshToken,
                                            (t) =>
                                              executeCeoChannelAction(t, {
                                                action: 'restore_channel',
                                                targetUid: ch.uid,
                                                reason,
                                              }).then(() => undefined),
                                            'Channel restored to active standing.'
                                          ),
                                      })
                                    }
                                    className="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 font-semibold"
                                  >
                                    Restore
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={isSelf}
                                    onClick={() =>
                                      openConfirm(
                                        {
                                          title: `Suspend Channel: ${ch.displayName}`,
                                          description:
                                            'Suspending this channel hides its creator showcase from public discovery without deleting the owner account.',
                                          scopeNotice:
                                            'Channel Suspension affects channel visibility only. The underlying user account stays intact.',
                                          confirmLabel: 'Suspend Channel',
                                          dangerTone: 'orange',
                                          onConfirm: async ({ reason, freshToken }) =>
                                            runWithToken(
                                              freshToken,
                                              (t) =>
                                                executeCeoChannelAction(t, {
                                                  action: 'suspend_channel',
                                                  targetUid: ch.uid,
                                                  reason,
                                                }).then(() => undefined),
                                              'Channel suspended.'
                                            ),
                                        },
                                        true
                                      )
                                    }
                                    className="px-2.5 py-1 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 font-semibold disabled:opacity-40"
                                  >
                                    Suspend
                                  </button>
                                )}

                                {cStatus !== 'deleted' && (
                                  <button
                                    type="button"
                                    disabled={isSelf}
                                    onClick={() =>
                                      openConfirm(
                                        {
                                          title: `Delete Channel (Recoverable): ${ch.displayName}`,
                                          description:
                                            'Are you sure you want to delete this channel? Initial deletion uses soft delete so it can be restored if accidental.',
                                          scopeNotice:
                                            'Distinction: This deletes the creator channel only — it does NOT delete the owner user account.',
                                          confirmLabel: 'Soft Delete Channel',
                                          dangerTone: 'red',
                                          onConfirm: async ({ reason, freshToken }) =>
                                            runWithToken(
                                              freshToken,
                                              (t) =>
                                                executeCeoChannelAction(t, {
                                                  action: 'soft_delete_channel',
                                                  targetUid: ch.uid,
                                                  reason,
                                                }).then(() => undefined),
                                              'Channel soft-deleted (recoverable).'
                                            ),
                                        },
                                        true
                                      )
                                    }
                                    className="px-2.5 py-1 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-300 font-semibold disabled:opacity-40"
                                  >
                                    Delete
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Channel & Owner Inspector Panel */}
            <div className="rounded-2xl bg-[#111115] border border-red-900/35 p-5 space-y-4">
              <h3 className="text-sm font-bold text-white">Channel & Owner Details</h3>
              {!selectedChannel ? (
                <p className="text-xs text-zinc-400">
                  Select any channel row to inspect owner identity, lifecycle statuses, and permanent deletion controls.
                </p>
              ) : (
                <div className="space-y-4 text-xs">
                  <div className="flex items-center gap-3">
                    <MediaImage
                      src={selectedChannel.avatarUrl}
                      alt={selectedChannel.displayName}
                      className="w-12 h-12 rounded-xl object-cover"
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-white truncate">{selectedChannel.displayName}</div>
                      <div className="font-mono text-zinc-400 truncate">@{selectedChannel.handle}</div>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-white/10">
                    <div className="flex justify-between gap-2">
                      <span className="text-zinc-400">Channel / Owner UID</span>
                      <span className="font-mono text-zinc-200 truncate">{selectedChannel.uid}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-zinc-400">Owner Email</span>
                      <span className="font-mono text-zinc-200 truncate">{selectedChannel.email || 'System / Unlinked'}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-zinc-400">Channel Status</span>
                      <span className="font-semibold text-white capitalize">
                        {selectedChannel.channelStatus || 'active'}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-zinc-400">Owner Account Status</span>
                      <span className="font-semibold text-white capitalize">
                        {selectedChannel.accountStatus || 'active'}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-zinc-400">Primary Language</span>
                      <span className="text-zinc-200">{selectedChannel.preferredLanguage || 'Hindi'}</span>
                    </div>
                  </div>

                  {selectedChannel.moderationReason && (
                    <div className="rounded-xl bg-black/40 border border-white/10 p-3 text-zinc-300">
                      <span className="block text-[11px] font-semibold text-zinc-400 mb-1">
                        Last Governance Reason
                      </span>
                      {selectedChannel.moderationReason}
                    </div>
                  )}

                  <div className="flex flex-col gap-2 pt-2 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => onOpenChannel(selectedChannel.uid)}
                      className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white font-semibold"
                    >
                      Open Public Channel Page
                    </button>

                    {selectedChannel.uid !== user.uid && (
                      <button
                        type="button"
                        onClick={() =>
                          openConfirm(
                            {
                              title: `Permanently Purge Channel: ${selectedChannel.displayName}`,
                              description:
                                'Permanent channel deletion purges all uploaded videos for this channel and clears creator metrics while keeping the user account separate.',
                              scopeNotice:
                                'This irreversible action records a mandatory entry in CEO Audit Logs before deleting channel content.',
                              confirmLabel: 'Permanently Delete Channel',
                              isPermanent: true,
                              dangerTone: 'red',
                              onConfirm: async ({ reason, confirmPhrase, freshToken }) =>
                                runWithToken(
                                  freshToken,
                                  (t) =>
                                    executeCeoChannelAction(t, {
                                      action: 'permanent_delete_channel',
                                      targetUid: selectedChannel.uid,
                                      reason,
                                      confirmPhrase,
                                    }).then(() => undefined),
                                  'Channel and owned videos permanently purged.'
                                ),
                            },
                            true
                          )
                        }
                        className="w-full py-2 rounded-xl bg-red-950/70 hover:bg-red-900/80 border border-red-800/70 text-red-200 font-semibold"
                      >
                        Permanent Delete Channel
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: VIDEO MANAGEMENT & REPORTED VIDEOS */}
      {activeTab === 'videos' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={videoQuery}
                onChange={(e) => setVideoQuery(e.target.value)}
                placeholder="Search videos by title, video ID, or creator..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#111115] border border-white/15 focus:border-[#F97316] text-sm text-white placeholder-zinc-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1.5 bg-[#111115] p-1 rounded-xl border border-white/10">
              {(['all', 'published', 'flagged', 'removed'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setVideoStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize whitespace-nowrap ${
                    videoStatusFilter === st
                      ? 'bg-[#DC2626] text-white'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            <div className="xl:col-span-2 rounded-2xl bg-[#111115] border border-white/10 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-black/40 border-b border-white/10 text-zinc-400">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Video</th>
                      <th className="py-3 px-4 font-semibold">Creator</th>
                      <th className="py-3 px-4 font-semibold">Status</th>
                      <th className="py-3 px-4 font-semibold text-right">Views</th>
                      <th className="py-3 px-4 font-semibold text-right">Controls</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredVideos.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-10 text-center text-zinc-400">
                          No videos found matching this filter.
                        </td>
                      </tr>
                    ) : (
                      filteredVideos.map((vid) => (
                        <tr
                          key={vid.id}
                          onClick={() => setSelectedVideo(vid)}
                          className={`cursor-pointer hover:bg-white/[0.03] ${
                            selectedVideo?.id === vid.id ? 'bg-red-950/20' : ''
                          }`}
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <MediaImage
                                src={vid.thumbnailUrl}
                                alt={vid.title}
                                className="w-16 h-10 rounded-lg object-cover shrink-0"
                              />
                              <div className="min-w-0 max-w-[220px]">
                                <div className="font-semibold text-white truncate">{vid.title}</div>
                                <div className="text-[11px] font-mono text-zinc-500 truncate">
                                  {vid.id} · {vid.language}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-zinc-200 font-medium">{vid.creatorName}</div>
                            <div className="text-[11px] font-mono text-zinc-500">{vid.creatorId}</div>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`font-semibold capitalize ${
                                vid.status === 'published'
                                  ? 'text-emerald-400'
                                  : vid.status === 'flagged'
                                  ? 'text-amber-400'
                                  : 'text-red-400'
                              }`}
                            >
                              {vid.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-zinc-200">
                            {formatCount(vid.viewsCount || 0)}
                          </td>
                          <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="inline-flex items-center gap-1.5">
                              {vid.status === 'published' ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    openConfirm({
                                      title: `Remove Video: ${vid.title}`,
                                      description:
                                        'Soft-removing hides this video from public feeds immediately while preserving recovery options.',
                                      confirmLabel: 'Remove Video',
                                      dangerTone: 'orange',
                                      onConfirm: async ({ reason, freshToken }) =>
                                        runWithToken(
                                          freshToken,
                                          (t) =>
                                            executeCeoVideoAction(t, {
                                              action: 'soft_remove',
                                              videoId: vid.id,
                                              reason,
                                            }).then(() => undefined),
                                          'Video soft-removed from platform.'
                                        ),
                                    })
                                  }
                                  className="px-2.5 py-1 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 font-semibold"
                                >
                                  Remove
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    openConfirm({
                                      title: `Restore Video: ${vid.title}`,
                                      description: 'Restore this removed or flagged video back to published status.',
                                      confirmLabel: 'Restore Video',
                                      dangerTone: 'orange',
                                      defaultReason: 'Video cleared on CEO review and restored',
                                      onConfirm: async ({ reason, freshToken }) =>
                                        runWithToken(
                                          freshToken,
                                          (t) =>
                                            executeCeoVideoAction(t, {
                                              action: 'restore',
                                              videoId: vid.id,
                                              reason,
                                            }).then(() => undefined),
                                          'Video restored to published catalog.'
                                        ),
                                    })
                                  }
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 font-semibold"
                                >
                                  Restore
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Video Inspector & Reported Videos */}
            <div className="space-y-4">
              <div className="rounded-2xl bg-[#111115] border border-red-900/35 p-5 space-y-3 text-xs">
                <h3 className="text-sm font-bold text-white">Video Details</h3>
                {!selectedVideo ? (
                  <p className="text-zinc-400">
                    Click any video row to inspect creator identity, removal reason, or trigger permanent deletion.
                  </p>
                ) : (
                  <div className="space-y-3">
                    <div className="font-semibold text-sm text-white">{selectedVideo.title}</div>
                    <div className="space-y-1.5 text-zinc-300">
                      <div>Creator: <span className="text-white font-semibold">{selectedVideo.creatorName}</span></div>
                      <div>Creator ID: <span className="font-mono text-zinc-400">{selectedVideo.creatorId}</span></div>
                      <div>Category / Language: {selectedVideo.category} · {selectedVideo.language}</div>
                      <div>Views / Likes / Shares: <span className="font-mono tabular-nums">{selectedVideo.viewsCount} / {selectedVideo.likesCount} / {selectedVideo.sharesCount || 0}</span></div>
                    </div>
                    {selectedVideo.removalReason && (
                      <div className="rounded-xl bg-black/40 border border-white/10 p-3 text-red-200">
                        Removal Reason: {selectedVideo.removalReason}
                      </div>
                    )}
                    <div className="flex flex-col gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => onWatchVideo(selectedVideo)}
                        className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white font-semibold"
                      >
                        Inspect Video Player
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          openConfirm(
                            {
                              title: `Permanently Delete Video: ${selectedVideo.title}`,
                              description: 'This permanently erases the video document from BharatPlay.',
                              confirmLabel: 'Permanently Delete Video',
                              isPermanent: true,
                              dangerTone: 'red',
                              onConfirm: async ({ reason, confirmPhrase, freshToken }) =>
                                runWithToken(
                                  freshToken,
                                  (t) =>
                                    executeCeoVideoAction(t, {
                                      action: 'permanent_delete',
                                      videoId: selectedVideo.id,
                                      reason,
                                      confirmPhrase,
                                    }).then(() => undefined),
                                  'Video permanently deleted.'
                                ),
                            },
                            true
                          )
                        }
                        className="w-full py-2 rounded-xl bg-red-950/70 hover:bg-red-900/80 border border-red-800/70 text-red-200 font-semibold"
                      >
                        Permanent Delete Video
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Reported Videos Queue */}
              <div className="rounded-2xl bg-[#111115] border border-white/10 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">Reported Videos</h3>
                  <span className="text-xs font-mono text-amber-400 tabular-nums">
                    {videoReports.filter((r) => r.status === 'pending').length} pending
                  </span>
                </div>
                {videoReports.length === 0 ? (
                  <p className="text-xs text-zinc-400">No video moderation reports submitted.</p>
                ) : (
                  <div className="space-y-2.5 max-h-72 overflow-y-auto">
                    {videoReports.map((rep) => (
                      <div key={rep.id} className="rounded-xl bg-black/40 border border-white/10 p-3 space-y-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-white truncate">
                            {rep.targetTitle || rep.targetId}
                          </span>
                          <span className="capitalize text-amber-300 font-semibold">{rep.status}</span>
                        </div>
                        <p className="text-zinc-400">{rep.reason}</p>
                        {rep.status === 'pending' && (
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() =>
                                openConfirm({
                                  title: 'Resolve & Remove Reported Video',
                                  description: 'Mark report resolved and soft-remove the reported video.',
                                  confirmLabel: 'Remove & Resolve',
                                  defaultReason: rep.reason,
                                  onConfirm: async ({ reason, freshToken }) =>
                                    runWithToken(
                                      freshToken,
                                      (t) =>
                                        executeCeoReportAction(t, {
                                          reportId: rep.id,
                                          status: 'resolved',
                                          reason,
                                          alsoSoftRemoveTarget: true,
                                        }).then(() => undefined),
                                      'Report resolved and video removed.'
                                    ),
                                })
                              }
                              className="px-2.5 py-1 rounded-lg bg-red-600/25 hover:bg-red-600/35 text-red-200 font-semibold"
                            >
                              Remove Video
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                openConfirm({
                                  title: 'Dismiss Video Report',
                                  description: 'Dismiss this report and keep the video published.',
                                  confirmLabel: 'Dismiss Report',
                                  dangerTone: 'orange',
                                  defaultReason: 'No violation found on CEO review',
                                  onConfirm: async ({ reason, freshToken }) =>
                                    runWithToken(
                                      freshToken,
                                      (t) =>
                                        executeCeoReportAction(t, {
                                          reportId: rep.id,
                                          status: 'dismissed',
                                          reason,
                                        }).then(() => undefined),
                                      'Report dismissed.'
                                    ),
                                })
                              }
                              className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-zinc-200 font-semibold"
                            >
                              Dismiss
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: USER MANAGEMENT & PERMISSIONS */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                placeholder="Search users by name, @handle, email, or UID..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#111115] border border-white/15 focus:border-[#F97316] text-sm text-white placeholder-zinc-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1.5 bg-[#111115] p-1 rounded-xl border border-white/10">
              {(['all', 'active', 'suspended', 'deleted'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setUserFilter(st)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize whitespace-nowrap ${
                    userFilter === st
                      ? 'bg-[#DC2626] text-white'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            <div className="xl:col-span-2 rounded-2xl bg-[#111115] border border-white/10 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-black/40 border-b border-white/10 text-zinc-400">
                    <tr>
                      <th className="py-3 px-4 font-semibold">User</th>
                      <th className="py-3 px-4 font-semibold">Role</th>
                      <th className="py-3 px-4 font-semibold">Account Status</th>
                      <th className="py-3 px-4 font-semibold text-right">Controls</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredUsers.map((u) => {
                      const aStatus = u.accountStatus || 'active';
                      const isSelf = u.uid === user.uid;
                      return (
                        <tr
                          key={u.uid}
                          onClick={() => setSelectedUser(u)}
                          className={`cursor-pointer hover:bg-white/[0.03] ${
                            selectedUser?.uid === u.uid ? 'bg-red-950/20' : ''
                          }`}
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <MediaImage
                                src={u.avatarUrl}
                                alt={u.displayName}
                                className="w-8 h-8 rounded-lg object-cover shrink-0"
                              />
                              <div className="min-w-0">
                                <div className="font-semibold text-white truncate">{u.displayName}</div>
                                <div className="text-[11px] font-mono text-zinc-500 truncate">
                                  {u.email || `@${u.handle}`} · {u.uid}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-mono font-semibold text-zinc-200 uppercase">
                              {u.role || (u.isCreator ? 'creator' : 'viewer')}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`font-semibold capitalize ${
                                aStatus === 'active'
                                  ? 'text-emerald-400'
                                  : aStatus === 'suspended'
                                  ? 'text-amber-400'
                                  : 'text-red-400'
                              }`}
                            >
                              {aStatus}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="inline-flex items-center gap-1.5">
                              {aStatus === 'active' ? (
                                <button
                                  type="button"
                                  disabled={isSelf}
                                  onClick={() =>
                                    openConfirm(
                                      {
                                        title: `Suspend Account: ${u.displayName}`,
                                        description:
                                          'Suspending this account disables uploads and creator publishing across BharatPlay.',
                                        confirmLabel: 'Suspend Account',
                                        dangerTone: 'orange',
                                        onConfirm: async ({ reason, freshToken }) =>
                                          runWithToken(
                                            freshToken,
                                            (t) =>
                                              executeCeoUserAction(t, {
                                                action: 'suspend_account',
                                                targetUid: u.uid,
                                                reason,
                                              }).then(() => undefined),
                                            'User account suspended.'
                                          ),
                                      },
                                      true
                                    )
                                  }
                                  className="px-2.5 py-1 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 font-semibold disabled:opacity-40"
                                >
                                  Suspend
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    openConfirm({
                                      title: `Reactivate Account: ${u.displayName}`,
                                      description: 'Restore active account standing for this user.',
                                      confirmLabel: 'Reactivate Account',
                                      dangerTone: 'orange',
                                      defaultReason: 'Account appeal approved by CEO',
                                      onConfirm: async ({ reason, freshToken }) =>
                                        runWithToken(
                                          freshToken,
                                          (t) =>
                                            executeCeoUserAction(t, {
                                              action: 'reactivate_account',
                                              targetUid: u.uid,
                                              reason,
                                            }).then(() => undefined),
                                          'User account reactivated.'
                                        ),
                                    })
                                  }
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 font-semibold"
                                >
                                  Reactivate
                                </button>
                              )}

                              <button
                                type="button"
                                disabled={isSelf}
                                onClick={() =>
                                  openConfirm(
                                    {
                                      title: `${u.isCreator ? 'Revoke' : 'Grant'} Creator Permissions`,
                                      description: `${
                                        u.isCreator
                                          ? 'Revoke creator publishing privileges for'
                                          : 'Enable creator channel & monetization eligibility for'
                                      } ${u.displayName}.`,
                                      confirmLabel: u.isCreator ? 'Revoke Creator' : 'Grant Creator',
                                      dangerTone: 'orange',
                                      defaultReason: u.isCreator
                                        ? 'Creator privileges revoked by CEO'
                                        : 'Creator privileges granted by CEO',
                                      onConfirm: async ({ reason, freshToken }) =>
                                        runWithToken(
                                          freshToken,
                                          (t) =>
                                            executeCeoUserAction(t, {
                                              action: 'set_creator_permission',
                                              targetUid: u.uid,
                                              value: !u.isCreator,
                                              reason,
                                            }).then(() => undefined),
                                          'Creator permissions updated.'
                                        ),
                                    },
                                    true
                                  )
                                }
                                className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-zinc-200 font-semibold disabled:opacity-40"
                              >
                                {u.isCreator ? 'Revoke Creator' : 'Make Creator'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* User Governance Inspector & User Reports */}
            <div className="space-y-4">
              <div className="rounded-2xl bg-[#111115] border border-red-900/35 p-5 space-y-3 text-xs">
                <h3 className="text-sm font-bold text-white">Account Governance</h3>
                {!selectedUser ? (
                  <p className="text-zinc-400">
                    Select any user row to view full profile, manage admin permissions, or execute soft/permanent account deletion.
                  </p>
                ) : (
                  <div className="space-y-3">
                    <div className="font-bold text-sm text-white">{selectedUser.displayName}</div>
                    <div className="space-y-1 text-zinc-300">
                      <div>Email: <span className="font-mono text-white">{selectedUser.email || 'System Seed'}</span></div>
                      <div>UID: <span className="font-mono text-zinc-400">{selectedUser.uid}</span></div>
                      <div>Role: <span className="font-mono uppercase text-[#F97316]">{selectedUser.role || 'viewer'}</span></div>
                      <div>Account Status: <span className="capitalize text-white">{selectedUser.accountStatus || 'active'}</span></div>
                    </div>

                    {selectedUser.uid !== user.uid && (
                      <div className="flex flex-col gap-2 pt-2 border-t border-white/10">
                        <button
                          type="button"
                          onClick={() =>
                            openConfirm(
                              {
                                title: `${selectedUser.role === 'admin' ? 'Revoke' : 'Grant'} Regular Admin Role`,
                                description:
                                  'Admins manage categories & community challenges, but NEVER receive CEO Command Center clearance.',
                                confirmLabel:
                                  selectedUser.role === 'admin' ? 'Revoke Admin Role' : 'Grant Admin Role',
                                dangerTone: 'orange',
                                onConfirm: async ({ reason, freshToken }) =>
                                  runWithToken(
                                    freshToken,
                                    (t) =>
                                      executeCeoUserAction(t, {
                                        action: 'set_admin_permission',
                                        targetUid: selectedUser.uid,
                                        value: selectedUser.role !== 'admin',
                                        reason,
                                      }).then(() => undefined),
                                    'Admin permission updated.'
                                  ),
                              },
                              true
                            )
                          }
                          className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-100 font-semibold"
                        >
                          {selectedUser.role === 'admin' ? 'Revoke Regular Admin' : 'Assign Regular Admin'}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            openConfirm(
                              {
                                title: `Soft Delete Account: ${selectedUser.displayName}`,
                                description:
                                  'Soft-deletes this user account and pauses channel access while keeping records recoverable via Reactivate.',
                                confirmLabel: 'Soft Delete Account',
                                dangerTone: 'red',
                                onConfirm: async ({ reason, freshToken }) =>
                                  runWithToken(
                                    freshToken,
                                    (t) =>
                                      executeCeoUserAction(t, {
                                        action: 'soft_delete_account',
                                        targetUid: selectedUser.uid,
                                        reason,
                                      }).then(() => undefined),
                                    'User account soft-deleted.'
                                  ),
                              },
                              true
                            )
                          }
                          className="w-full py-2 rounded-xl bg-amber-950/60 hover:bg-amber-900/70 border border-amber-800/50 text-amber-200 font-semibold"
                        >
                          Soft Delete Account
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            openConfirm(
                              {
                                title: `Permanently Delete Account: ${selectedUser.displayName}`,
                                description:
                                  'Irreversibly deletes the user account, private account record, and owned videos. An immutable CEO Audit Log record will be written atomically.',
                                confirmLabel: 'Permanently Delete Account',
                                isPermanent: true,
                                dangerTone: 'red',
                                onConfirm: async ({ reason, confirmPhrase, freshToken }) =>
                                  runWithToken(
                                    freshToken,
                                    (t) =>
                                      executeCeoUserAction(t, {
                                        action: 'permanent_delete_account',
                                        targetUid: selectedUser.uid,
                                        reason,
                                        confirmPhrase,
                                      }).then(() => undefined),
                                    'Account permanently deleted with permanent audit log.'
                                  ),
                              },
                              true
                            )
                          }
                          className="w-full py-2 rounded-xl bg-red-950/70 hover:bg-red-900/80 border border-red-800/70 text-red-200 font-semibold"
                        >
                          Permanent Delete Account
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* User Reports */}
              <div className="rounded-2xl bg-[#111115] border border-white/10 p-5 space-y-3">
                <h3 className="text-sm font-bold text-white">User Reports</h3>
                {userReports.length === 0 ? (
                  <p className="text-xs text-zinc-400">No user account reports queued.</p>
                ) : (
                  <div className="space-y-2.5 max-h-64 overflow-y-auto">
                    {userReports.map((rep) => (
                      <div key={rep.id} className="rounded-xl bg-black/40 border border-white/10 p-3 text-xs space-y-1.5">
                        <div className="flex justify-between font-semibold text-white">
                          <span>{rep.targetTitle || rep.targetId}</span>
                          <span className="capitalize text-amber-300">{rep.status}</span>
                        </div>
                        <p className="text-zinc-400">{rep.reason}</p>
                        {rep.status === 'pending' && (
                          <div className="flex gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() =>
                                openConfirm({
                                  title: 'Resolve User Report',
                                  description: 'Mark user report resolved.',
                                  confirmLabel: 'Resolve Report',
                                  defaultReason: rep.reason,
                                  onConfirm: async ({ reason, freshToken }) =>
                                    runWithToken(
                                      freshToken,
                                      (t) =>
                                        executeCeoReportAction(t, {
                                          reportId: rep.id,
                                          status: 'resolved',
                                          reason,
                                        }).then(() => undefined),
                                      'User report resolved.'
                                    ),
                                })
                              }
                              className="px-2.5 py-1 rounded-lg bg-emerald-600/20 text-emerald-300 font-semibold"
                            >
                              Resolve
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: CREATOR VERIFICATION & RISING STATUS */}
      {activeTab === 'verification' && (
        <div className="space-y-4">
          <div className="relative max-w-md">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={verifyQuery}
              onChange={(e) => setVerifyQuery(e.target.value)}
              placeholder="Search creators for verification, featuring, or Rising status..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#111115] border border-white/15 focus:border-[#F97316] text-sm text-white placeholder-zinc-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredCreatorsForVerify.map((cr) => (
              <div
                key={cr.uid}
                className="rounded-2xl bg-[#111115] border border-white/10 p-4 flex flex-col justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <MediaImage
                    src={cr.avatarUrl}
                    alt={cr.displayName}
                    className="w-12 h-12 rounded-xl object-cover shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="font-bold text-white flex items-center gap-1.5 truncate">
                      <span className="truncate">{cr.displayName}</span>
                      {cr.isVerified && <BadgeCheck className="w-4 h-4 text-[#F97316] shrink-0" />}
                    </div>
                    <div className="text-xs text-zinc-400">
                      @{cr.handle} · {formatCount(cr.subscribersCount || 0)} subs
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() =>
                      openConfirm({
                        title: `${cr.isVerified ? 'Remove Verification' : 'Verify Creator'}: ${cr.displayName}`,
                        description: cr.isVerified
                          ? 'Remove the official BharatPlay verification badge from this creator.'
                          : 'Grant the official BharatPlay Verified badge across cards and channel pages.',
                        confirmLabel: cr.isVerified ? 'Remove Badge' : 'Verify Creator',
                        dangerTone: 'orange',
                        defaultReason: cr.isVerified
                          ? 'Verification revoked by CEO'
                          : 'Manual CEO creator verification granted',
                        onConfirm: async ({ reason, freshToken }) =>
                          runWithToken(
                            freshToken,
                            (t) =>
                              executeCeoUserAction(t, {
                                action: 'set_verification',
                                targetUid: cr.uid,
                                value: !cr.isVerified,
                                reason,
                              }).then(() => undefined),
                            cr.isVerified ? 'Verification badge removed.' : 'Creator verified.'
                          ),
                      })
                    }
                    className={`py-2 px-2 rounded-xl font-semibold border transition-colors ${
                      cr.isVerified
                        ? 'bg-[#F97316]/20 border-[#F97316]/50 text-[#FDBA74]'
                        : 'bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10'
                    }`}
                  >
                    {cr.isVerified ? 'Verified ✓' : 'Verify'}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      openConfirm({
                        title: `${cr.isFeatured ? 'Unfeature' : 'Feature on Homepage'}: ${cr.displayName}`,
                        description: cr.isFeatured
                          ? 'Remove creator from Homepage Featured & Spotlight placements.'
                          : 'Feature this creator in Homepage Indian Creators spotlight.',
                        confirmLabel: cr.isFeatured ? 'Unfeature' : 'Feature Creator',
                        dangerTone: 'orange',
                        defaultReason: cr.isFeatured
                          ? 'Homepage feature rotated by CEO'
                          : 'Featured on BharatPlay homepage by CEO',
                        onConfirm: async ({ reason, freshToken }) =>
                          runWithToken(
                            freshToken,
                            (t) =>
                              executeCeoUserAction(t, {
                                action: 'set_featured',
                                targetUid: cr.uid,
                                value: !cr.isFeatured,
                                reason,
                              }).then(() => undefined),
                            cr.isFeatured ? 'Creator unfeatured.' : 'Creator featured on homepage.'
                          ),
                      })
                    }
                    className={`py-2 px-2 rounded-xl font-semibold border transition-colors ${
                      cr.isFeatured
                        ? 'bg-[#E11D48]/20 border-[#E11D48]/50 text-rose-200'
                        : 'bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10'
                    }`}
                  >
                    {cr.isFeatured ? 'Featured ★' : 'Feature'}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      openConfirm({
                        title: `${cr.isEarlyCreator || cr.boostEnabled ? 'Remove' : 'Grant'} Rising Creator Status`,
                        description:
                          'Manage Rising Creator badge & Creator Boost eligibility for this channel.',
                        confirmLabel: 'Update Rising Status',
                        dangerTone: 'orange',
                        defaultReason: 'CEO Rising Creator status review',
                        onConfirm: async ({ reason, freshToken }) =>
                          runWithToken(
                            freshToken,
                            (t) =>
                              executeCeoUserAction(t, {
                                action: 'set_rising_creator',
                                targetUid: cr.uid,
                                value: !(cr.isEarlyCreator || cr.boostEnabled),
                                reason,
                              }).then(() => undefined),
                            'Rising Creator status updated.'
                          ),
                      })
                    }
                    className={`py-2 px-2 rounded-xl font-semibold border transition-colors ${
                      cr.isEarlyCreator || cr.boostEnabled
                        ? 'bg-emerald-600/20 border-emerald-600/40 text-emerald-300'
                        : 'bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10'
                    }`}
                  >
                    {cr.isEarlyCreator || cr.boostEnabled ? 'Rising ↑' : 'Set Rising'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: GLOBAL PLATFORM ANNOUNCEMENTS */}
      {activeTab === 'announcements' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <form
            onSubmit={handlePublishAnnouncement}
            className="lg:col-span-2 rounded-2xl bg-[#111115] border border-red-900/40 p-5 space-y-4 h-fit"
          >
            <div>
              <h2 className="text-base font-bold text-white">Broadcast Global Announcement</h2>
              <p className="text-xs text-zinc-400">
                Appears across Notification Center and Homepage Announcement Banner for all BharatPlay users.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">Announcement Title</label>
              <input
                type="text"
                required
                value={annTitle}
                onChange={(e) => setAnnTitle(e.target.value)}
                placeholder="e.g., BharatPlay Creator League Season Opens"
                className="w-full rounded-xl bg-[#09090B] border border-white/15 focus:border-[#F97316] px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">Category</label>
              <select
                value={annCategory}
                onChange={(e) => setAnnCategory(e.target.value as any)}
                className="w-full rounded-xl bg-[#09090B] border border-white/15 focus:border-[#F97316] px-3.5 py-2.5 text-sm text-white focus:outline-none"
              >
                <option value="policy">Policy & Governance</option>
                <option value="feature">Platform Feature</option>
                <option value="league">Creator League</option>
                <option value="event">Official Event</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">Message Body</label>
              <textarea
                rows={4}
                required
                value={annBody}
                onChange={(e) => setAnnBody(e.target.value)}
                placeholder="Write platform-wide message for Indian creators and viewers..."
                className="w-full rounded-xl bg-[#09090B] border border-white/15 focus:border-[#F97316] px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={publishingAnn}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#DC2626] to-[#F97316] text-xs font-bold text-white hover:opacity-95 disabled:opacity-50"
            >
              {publishingAnn ? 'Broadcasting...' : 'Publish Platform-Wide Announcement'}
            </button>
          </form>

          <div className="lg:col-span-3 rounded-2xl bg-[#111115] border border-white/10 divide-y divide-white/5">
            <div className="px-5 py-4">
              <h2 className="text-base font-bold text-white">Active & Past Announcements</h2>
            </div>
            {allAnnouncements.length === 0 ? (
              <div className="p-8 text-center text-sm text-zinc-400">
                No announcements published yet.
              </div>
            ) : (
              allAnnouncements.map((ann) => (
                <div key={ann.id} className="px-5 py-4 flex items-start justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="uppercase font-bold text-[#F97316]">{ann.category}</span>
                      <span className="text-zinc-500">·</span>
                      <span className={ann.isActive ? 'text-emerald-400 font-semibold' : 'text-zinc-500'}>
                        {ann.isActive ? 'Active' : 'Paused'}
                      </span>
                    </div>
                    <div className="font-semibold text-sm text-white">{ann.title}</div>
                    <p className="text-xs text-zinc-300">{ann.body}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-xs">
                    <button
                      type="button"
                      onClick={() =>
                        runWithToken(
                          undefined,
                          (t) =>
                            executeCeoAnnouncementAction(t, {
                              action: 'toggle',
                              announcementId: ann.id,
                              isActive: !ann.isActive,
                            }).then(() => undefined),
                          ann.isActive ? 'Announcement paused.' : 'Announcement activated.'
                        )
                      }
                      className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-200 font-semibold"
                    >
                      {ann.isActive ? 'Pause' : 'Activate'}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        runWithToken(
                          undefined,
                          (t) =>
                            executeCeoAnnouncementAction(t, {
                              action: 'delete',
                              announcementId: ann.id,
                            }).then(() => undefined),
                          'Announcement deleted.'
                        )
                      }
                      className="p-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-300"
                      aria-label="Delete announcement"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 7: PERMANENT IMMUTABLE CEO AUDIT LOGS */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={auditQuery}
                onChange={(e) => setAuditQuery(e.target.value)}
                placeholder="Search logs by action, target ID, or reason..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#111115] border border-white/15 focus:border-[#F97316] text-sm text-white placeholder-zinc-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1.5 bg-[#111115] p-1 rounded-xl border border-white/10 overflow-x-auto">
              {['all', 'channel', 'video', 'user', 'report', 'announcement'].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setAuditTypeFilter(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize whitespace-nowrap ${
                    auditTypeFilter === t
                      ? 'bg-[#DC2626] text-white'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-[#111115] border border-red-900/35 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-black/50 border-b border-white/10 text-zinc-400">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Timestamp</th>
                    <th className="py-3 px-4 font-semibold">CEO Action</th>
                    <th className="py-3 px-4 font-semibold">Target</th>
                    <th className="py-3 px-4 font-semibold">Audit Reason & Details</th>
                    <th className="py-3 px-4 font-semibold text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredAuditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-zinc-400">
                        No CEO audit records match your filter.
                      </td>
                    </tr>
                  ) : (
                    filteredAuditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-white/[0.02]">
                        <td className="py-3 px-4 font-mono text-zinc-400 whitespace-nowrap tabular-nums">
                          {formatTimestamp(log.createdAt)}
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold text-[#F97316] whitespace-nowrap">
                          {log.action}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-white">{log.targetLabel || log.targetId}</div>
                          <div className="text-[11px] font-mono text-zinc-500">
                            {log.targetType} · {log.targetId}
                          </div>
                        </td>
                        <td className="py-3 px-4 max-w-md">
                          <div className="text-zinc-200">{log.reason}</div>
                          {log.details && <div className="text-[11px] text-zinc-500 mt-0.5">{log.details}</div>}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold uppercase">
                          <span
                            className={
                              log.status === 'success'
                                ? 'text-emerald-400'
                                : log.status === 'blocked'
                                ? 'text-amber-400'
                                : 'text-red-400'
                            }
                          >
                            {log.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Mandatory Confirmation & Step-Up Authentication Dialog */}
      <CeoConfirmDialog
        pending={pendingAction}
        requiresStepUpAuth={pendingRequiresStepUp}
        onStepUpReauth={() => reauthenticateCeo()}
        onClose={() => setPendingAction(null)}
      />
    </div>
  );
}
