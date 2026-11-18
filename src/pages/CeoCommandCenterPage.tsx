import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  Briefcase,
  CheckCircle2,
  Crown,
  Film,
  IndianRupee,
  KeyRound,
  Lock,
  Megaphone,
  QrCode,
  RefreshCw,
  Scale,
  ScrollText,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  TrendingUp,
  Tv,
  Users,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import { MediaImage } from '../components/MediaImage';
import { CeoConfirmDialog, type PendingCeoAction } from '../components/CeoConfirmDialog';
import { CeoPaymentVerificationPanel } from '../components/CeoPaymentVerificationPanel';
import {
  executeCeoAdminPermissions,
  executeCeoAnnouncementAction,
  executeCeoChannelAction,
  executeCeoCreatorMonetization,
  executeCeoMonetizationConfig,
  executeCeoPayoutAction,
  executeCeoReportAction,
  executeCeoUserAction,
  executeCeoVideoAction,
  fetchCeoOverview,
} from '../lib/ceoService';
import {
  fetchMonetizationGovernanceOverview,
  govBrandConnectAction,
  govRecordAdRevenue,
  govResolveDispute,
  govResolveInvalidTraffic,
  govVerifyQrPayment,
  type MonetizationGovernanceOverview,
} from '../lib/monetizationService';
import { formatCount, formatInr } from '../lib/formatters';
import {
  ADMIN_PERMISSION_LABELS,
  DEFAULT_ADMIN_PERMISSIONS,
  type AdminPermissionKey,
  type AdminPermissions,
  type AppRoute,
  type CeoEnrichedUser,
  type CeoOverviewResponse,
  type VideoItem,
} from '../types/bharatplay';

interface CeoCommandCenterPageProps {
  onOpenChannel: (channelId: string) => void;
  onWatchVideo: (video: VideoItem) => void;
  onNavigate: (route: AppRoute) => void;
}

type CeoTab =
  | 'overview'
  | 'admins'
  | 'monetization'
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

  // Admin Permissions Editor state
  const [adminTargetUid, setAdminTargetUid] = useState('');
  const [adminPermDraft, setAdminPermDraft] = useState<AdminPermissions>({
    ...DEFAULT_ADMIN_PERMISSIONS,
    resolveReports: true,
    moderateVideos: true,
  });
  const [adminNotes, setAdminNotes] = useState('');

  // Platform Monetization & Settings state
  const [monGov, setMonGov] = useState<MonetizationGovernanceOverview | null>(null);
  const [monSubTab, setMonSubTab] = useState<
    'config_payouts' | 'qr_payments' | 'ad_revenue' | 'ivt' | 'disputes' | 'brand_connect'
  >('config_payouts');
  const [cfgRevShare, setCfgRevShare] = useState(75);
  const [cfgAdShare, setCfgAdShare] = useState(75);
  const [cfgMembershipShare, setCfgMembershipShare] = useState(80);
  const [cfgSupportShare, setCfgSupportShare] = useState(85);
  const [cfgPaidVideoShare, setCfgPaidVideoShare] = useState(80);
  const [cfgGatewayMode, setCfgGatewayMode] = useState<'unconfigured' | 'test' | 'live'>('unconfigured');
  const [cfgMinPayout, setCfgMinPayout] = useState(500);
  const [cfgEarlyBoost, setCfgEarlyBoost] = useState(true);
  const [cfgMaintenance, setCfgMaintenance] = useState(false);
  const [cfgCategoriesText, setCfgCategoriesText] = useState('');
  const [cfgLanguagesText, setCfgLanguagesText] = useState('');
  const [payoutStatusFilter, setPayoutStatusFilter] = useState<'all' | 'pending' | 'approved' | 'paid' | 'rejected'>('all');
  const [creatorBalanceEdits, setCreatorBalanceEdits] = useState<Record<string, string>>({});

  // Ad Revenue recording form
  const [adVideoId, setAdVideoId] = useState('');
  const [adPeriod, setAdPeriod] = useState('Current Cycle');
  const [adValidImpr, setAdValidImpr] = useState(0);
  const [adInvalidImpr, setAdInvalidImpr] = useState(0);
  const [adGrossInr, setAdGrossInr] = useState(0);
  const [adInitialStatus, setAdInitialStatus] = useState<'verified' | 'pending'>('verified');

  // Invalid Traffic flag form
  const [ivtTargetType, setIvtTargetType] = useState<'video' | 'affiliate' | 'creator'>('video');
  const [ivtTargetId, setIvtTargetId] = useState('');
  const [ivtCreatorId, setIvtCreatorId] = useState('');
  const [ivtSignalType, setIvtSignalType] = useState('Repeated click burst / bot signature');
  const [ivtCount, setIvtCount] = useState(10);
  const [ivtImpactInr, setIvtImpactInr] = useState(0);
  const [ivtSeverity, setIvtSeverity] = useState<'low' | 'medium' | 'high'>('medium');
  const [ivtDeductRecordId, setIvtDeductRecordId] = useState('');

  // Brand Connect campaign form
  const [bcBrandName, setBcBrandName] = useState('');
  const [bcTitle, setBcTitle] = useState('');
  const [bcBudgetInr, setBcBudgetInr] = useState(25000);
  const [bcCategory, setBcCategory] = useState('Tech');
  const [bcDeliverables, setBcDeliverables] = useState('1 Dedicated Integration + 1 Bharat Short');
  const [bcDeadline, setBcDeadline] = useState('2026-12-31');
  const [bcDesc, setBcDesc] = useState('');

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
      const [overview, monOverview] = await Promise.all([
        fetchCeoOverview(token),
        fetchMonetizationGovernanceOverview(token).catch(() => null),
      ]);
      setData(overview);
      setMonGov(monOverview);
      if (overview.platformConfig) {
        const pc = overview.platformConfig;
        setCfgRevShare(Number(pc.creatorRevenueSharePercent ?? 75));
        setCfgAdShare(Number(pc.adSharePercent ?? pc.creatorRevenueSharePercent ?? 75));
        setCfgMembershipShare(Number(pc.membershipSharePercent ?? 80));
        setCfgSupportShare(Number(pc.supportSharePercent ?? 85));
        setCfgPaidVideoShare(Number(pc.paidVideoSharePercent ?? 80));
        setCfgGatewayMode(pc.paymentGatewayMode || 'unconfigured');
        setCfgMinPayout(Number(pc.minPayoutInr ?? 500));
        setCfgEarlyBoost(Boolean(pc.earlyCreatorBoostEnabled));
        setCfgMaintenance(Boolean(pc.maintenanceMode));
        setCfgCategoriesText((pc.categories || []).join(', '));
        setCfgLanguagesText((pc.languages || []).join(', '));
      }
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
        <div className="rounded-2xl bg-white dark:bg-[#0D0D10] border border-red-200 dark:border-red-900/60 p-8 space-y-4 shadow-sm dark:shadow-none">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/50 flex items-center justify-center text-red-600 dark:text-red-400">
            <Lock className="w-7 h-7" />
          </div>
          <div className="text-xs font-semibold uppercase tracking-widest text-red-600 dark:text-red-400">
            403 · Unauthorized Access
          </div>
          <h1 className="text-2xl font-display font-bold text-zinc-900 dark:text-white">
            BHARATPLAY CEO Command Center Restricted
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
            This executive console is exclusively restricted to the verified Platform CEO account. Viewers, creators, moderators, and standard administrators do not have clearance to access CEO routes or APIs.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => onNavigate('home')}
              className="px-5 py-2.5 rounded-xl bg-zinc-100 dark:bg-white/10 hover:bg-zinc-200 dark:hover:bg-white/15 text-sm font-semibold text-zinc-900 dark:text-white"
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
  const allAdmins = data?.admins || [];
  const allVideos = data?.videos || [];
  const allReports = data?.reports || [];
  const allAnnouncements = data?.announcements || [];
  const allPayouts = data?.payouts || [];
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
        (log.actorEmail || '').toLowerCase().includes(q) ||
        (log.actorRole || '').toLowerCase().includes(q) ||
        log.reason.toLowerCase().includes(q)
      );
    });
  }, [allAuditLogs, auditQuery, auditTypeFilter]);

  const eligibleForAdmin = useMemo(
    () => allUsers.filter((u) => u.uid !== user.uid && u.role !== 'ceo' && u.accountStatus !== 'deleted'),
    [allUsers, user.uid]
  );

  const filteredPayouts = useMemo(() => {
    if (payoutStatusFilter === 'all') return allPayouts;
    return allPayouts.filter((p) => p.status === payoutStatusFilter);
  }, [allPayouts, payoutStatusFilter]);

  const monetizationCreators = useMemo(
    () => allUsers.filter((u) => u.isCreator && u.channelStatus !== 'deleted'),
    [allUsers]
  );

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
    {
      id: 'admins',
      label: 'Admins & Permissions',
      icon: <ShieldCheck className="w-4 h-4" />,
      badge: allAdmins.length || undefined,
    },
    {
      id: 'monetization',
      label: 'Monetization & Payouts',
      icon: <IndianRupee className="w-4 h-4" />,
      badge: metrics?.pendingPayoutsCount || undefined,
    },
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
    { id: 'audit', label: 'CEO & Admin Audit Logs', icon: <ScrollText className="w-4 h-4" /> },
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
        <div className="rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/60 px-4 py-3 text-sm text-red-800 dark:text-red-200 flex items-center justify-between gap-3">
          <span>{loadError}</span>
          <button
            type="button"
            onClick={loadTelemetry}
            className="px-3 py-1.5 rounded-lg bg-red-600 dark:bg-red-800 hover:bg-red-700 text-xs font-semibold text-white whitespace-nowrap"
          >
            Retry
          </button>
        </div>
      )}

      {/* KPI Command Strip */}
      <section className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {[
          { label: 'Registered Users', value: metrics?.totalUsers ?? 0, accent: 'text-zinc-900 dark:text-white' },
          { label: 'Total Creators', value: metrics?.totalCreators ?? 0, accent: 'text-[#EA580C] dark:text-[#F97316]' },
          { label: 'Total Channels', value: metrics?.totalChannels ?? 0, accent: 'text-zinc-900 dark:text-white' },
          { label: 'Uploaded Videos', value: metrics?.totalVideos ?? 0, accent: 'text-zinc-900 dark:text-white' },
          { label: 'Platform Views', value: formatCount(metrics?.totalPlatformViews ?? 0), accent: 'text-[#EA580C] dark:text-[#F97316]' },
          { label: 'Active Users', value: metrics?.activeUsers ?? 0, accent: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Suspended Accounts', value: metrics?.suspendedAccounts ?? 0, accent: 'text-red-600 dark:text-red-400' },
          { label: 'Pending Reports', value: metrics?.pendingReports ?? 0, accent: 'text-amber-600 dark:text-amber-400' },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl bg-white dark:bg-[#111115] border border-red-200 dark:border-red-900/30 px-3.5 py-3 space-y-1 shadow-xs dark:shadow-none"
          >
            <div className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 truncate">{kpi.label}</div>
            <div className={`text-xl font-display font-bold tabular-nums ${kpi.accent}`}>
              {loading && !data ? '—' : kpi.value}
            </div>
          </div>
        ))}
      </section>

      {/* Enterprise Navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar border-b border-zinc-200 dark:border-white/10 pb-2">
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
                  : 'bg-white dark:bg-[#111115] text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5 border border-zinc-200 dark:border-white/10'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.badge ? (
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold tabular-nums ${
                  active ? 'bg-black/30 text-amber-200' : 'bg-amber-50 dark:bg-black/40 text-amber-700 dark:text-amber-300'
                }`}>
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
          <div className="lg:col-span-2 rounded-2xl bg-white dark:bg-[#111115] border border-zinc-200 dark:border-white/10 overflow-hidden shadow-xs dark:shadow-none">
            <div className="px-5 py-4 border-b border-zinc-200 dark:border-white/10 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-zinc-900 dark:text-white">Recent Platform & CEO Activity</h2>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  Chronological record of governance actions, moderation events, and announcements
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('audit')}
                className="text-xs font-semibold text-[#EA580C] dark:text-[#F97316] hover:underline whitespace-nowrap"
              >
                Full Audit Ledger
              </button>
            </div>
            <div className="divide-y divide-zinc-200 dark:divide-white/5">
              {allAuditLogs.length === 0 ? (
                <div className="p-8 text-center text-sm text-zinc-600 dark:text-zinc-400">
                  No CEO governance actions recorded yet. Every channel, video, user, verification, and announcement action is logged automatically here.
                </div>
              ) : (
                allAuditLogs.slice(0, 8).map((log) => (
                  <div key={log.id} className="px-5 py-3.5 flex items-start justify-between gap-4 hover:bg-zinc-50 dark:hover:bg-white/[0.02]">
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2 text-xs font-semibold text-zinc-900 dark:text-white">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                            log.actorRole === 'admin'
                              ? 'bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50'
                              : 'bg-red-50 dark:bg-red-950 text-[#EA580C] dark:text-[#F97316] border border-red-200 dark:border-red-800/50'
                          }`}
                        >
                          {log.actorRole || 'ceo'}
                        </span>
                        <span className="font-mono text-[#EA580C] dark:text-[#F97316]">{log.action}</span>
                        <span className="text-zinc-400 dark:text-zinc-500">·</span>
                        <span className="truncate">{log.targetLabel || log.targetId}</span>
                      </div>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-1">{log.reason}</p>
                    </div>
                    <div className="text-right shrink-0 space-y-0.5">
                      <div
                        className={`text-[11px] font-semibold ${
                          log.status === 'success'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : log.status === 'blocked'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-red-600 dark:text-red-400'
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
            <div className="rounded-2xl bg-white dark:bg-[#111115] border border-red-200 dark:border-red-900/35 p-5 space-y-3 shadow-xs dark:shadow-none">
              <h2 className="text-base font-bold text-zinc-900 dark:text-white">Catalog & Governance Snapshot</h2>
              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between py-1.5 border-b border-zinc-200 dark:border-white/5">
                  <span className="text-zinc-600 dark:text-zinc-400">Published Videos</span>
                  <span className="font-mono font-bold text-zinc-900 dark:text-white tabular-nums">{metrics?.publishedVideos ?? 0}</span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-zinc-200 dark:border-white/5">
                  <span className="text-zinc-600 dark:text-zinc-400">Total Watch Time</span>
                  <span className="font-mono font-bold text-zinc-900 dark:text-white tabular-nums">{metrics?.totalWatchHours ?? 0} hrs</span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-zinc-200 dark:border-white/5">
                  <span className="text-zinc-600 dark:text-zinc-400">Active Admins / Pending Payouts</span>
                  <span className="font-mono font-bold text-[#EA580C] dark:text-[#F97316] tabular-nums">
                    {metrics?.totalAdmins ?? 0} / {metrics?.pendingPayoutsCount ?? 0}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-zinc-200 dark:border-white/5">
                  <span className="text-zinc-600 dark:text-zinc-400">Suspended Channels</span>
                  <span className="font-mono font-bold text-red-600 dark:text-red-400 tabular-nums">{metrics?.suspendedChannels ?? 0}</span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-zinc-200 dark:border-white/5">
                  <span className="text-zinc-600 dark:text-zinc-400">Live Streams Active</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{metrics?.liveStreamsActive ?? 0}</span>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-zinc-600 dark:text-zinc-400">Active Challenges / League</span>
                  <span className="font-mono font-bold text-[#EA580C] dark:text-[#F97316] tabular-nums">
                    {(metrics?.activeChallenges ?? 0)} / {(metrics?.activeCompetitions ?? 0)}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-white dark:bg-[#111115] border border-zinc-200 dark:border-white/10 p-5 space-y-3 shadow-xs dark:shadow-none">
              <h2 className="text-base font-bold text-zinc-900 dark:text-white">Safety & Governance Policy</h2>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Channel removal and video moderation preserve recovery paths initially. Admin roles never access monetization, payouts, account deletion, or the CEO Command Center.
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('admins')}
                  className="px-3 py-2 rounded-xl bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 text-xs font-semibold text-zinc-900 dark:text-white text-center"
                >
                  Admin RBAC
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('monetization')}
                  className="px-3 py-2 rounded-xl bg-rose-50 dark:bg-[#E11D48]/20 hover:bg-rose-100 dark:hover:bg-[#E11D48]/30 border border-rose-200 dark:border-[#E11D48]/40 text-xs font-semibold text-rose-700 dark:text-rose-200 text-center"
                >
                  Monetization
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: ADMINS & GRANULAR PERMISSIONS */}
      {activeTab === 'admins' && (
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          {/* Assign / Edit Admin Permissions Form */}
          <div className="xl:col-span-2 rounded-2xl bg-white dark:bg-[#111115] border border-red-200 dark:border-red-900/40 p-5 space-y-4 h-fit shadow-xs dark:shadow-none">
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#EA580C] dark:text-[#F97316]" />
                <span>Assign & Scope Admin Permissions</span>
              </h2>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                Grant explicit operational permissions to a verified user. Admins cannot view or alter CEO permissions, monetization, payouts, or user deletions.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">Select Account</label>
              <select
                value={adminTargetUid}
                onChange={(e) => {
                  const uid = e.target.value;
                  setAdminTargetUid(uid);
                  const existingAdm = allAdmins.find((a) => a.uid === uid);
                  if (existingAdm) {
                    setAdminPermDraft(existingAdm.permissions);
                    setAdminNotes(existingAdm.notes || '');
                  } else {
                    setAdminPermDraft({
                      ...DEFAULT_ADMIN_PERMISSIONS,
                      resolveReports: true,
                      moderateVideos: true,
                    });
                    setAdminNotes('');
                  }
                }}
                className="w-full rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-300 dark:border-white/15 focus:border-[#F97316] px-3.5 py-2.5 text-xs text-zinc-900 dark:text-white focus:outline-none"
              >
                <option value="">-- Choose user or existing Admin --</option>
                {eligibleForAdmin.map((u) => (
                  <option key={u.uid} value={u.uid}>
                    {u.displayName} ({u.email || `@${u.handle}`}) — {u.role?.toUpperCase() || 'VIEWER'}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2 pt-1">
              <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">CEO-Delegated Permissions</div>
              {(Object.keys(ADMIN_PERMISSION_LABELS) as AdminPermissionKey[]).map((key) => {
                const info = ADMIN_PERMISSION_LABELS[key];
                const checked = adminPermDraft[key];
                return (
                  <label
                    key={key}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                      checked
                        ? 'bg-orange-50 dark:bg-red-950/30 border-[#F97316]/60 dark:border-[#F97316]/50'
                        : 'bg-zinc-50 dark:bg-[#09090B] border-zinc-200 dark:border-white/10 hover:border-zinc-300 dark:hover:border-white/20'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) =>
                        setAdminPermDraft((prev) => ({ ...prev, [key]: e.target.checked }))
                      }
                      className="mt-0.5 accent-[#F97316]"
                    />
                    <div className="space-y-0.5">
                      <div className="text-xs font-semibold text-zinc-900 dark:text-white">{info.label}</div>
                      <div className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-snug">{info.description}</div>
                    </div>
                  </label>
                );
              })}
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Delegation Notes</label>
              <input
                type="text"
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="e.g., Content moderation & League support"
                className="w-full rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-300 dark:border-white/15 focus:border-[#F97316] px-3.5 py-2 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none"
              />
            </div>

            <button
              type="button"
              disabled={!adminTargetUid}
              onClick={() => {
                const target = eligibleForAdmin.find((u) => u.uid === adminTargetUid);
                if (!target) return;
                openConfirm(
                  {
                    title: `Save Admin Permissions: ${target.displayName}`,
                    description: 'Applies explicit scoped permissions on the backend and logs to the immutable audit ledger.',
                    confirmLabel: 'Save Admin Role',
                    dangerTone: 'orange',
                    defaultReason: adminNotes || 'CEO granted/updated scoped Admin permissions',
                    onConfirm: async ({ reason, freshToken }) =>
                      runWithToken(
                        freshToken,
                        (t) =>
                          executeCeoAdminPermissions(t, {
                            targetUid: target.uid,
                            enabled: true,
                            permissions: adminPermDraft,
                            notes: adminNotes || reason,
                            reason,
                          }).then(() => undefined),
                        `Scoped Admin permissions saved for ${target.displayName}.`
                      ),
                  },
                  true
                );
              }}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#DC2626] to-[#F97316] text-xs font-bold text-white disabled:opacity-40"
            >
              Save Scoped Admin Permissions
            </button>
          </div>

          {/* Active Administrators Directory */}
          <div className="xl:col-span-3 rounded-2xl bg-white dark:bg-[#111115] border border-zinc-200 dark:border-white/10 overflow-hidden h-fit shadow-xs dark:shadow-none">
            <div className="px-5 py-4 border-b border-zinc-200 dark:border-white/10 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-zinc-900 dark:text-white">Active Administrators ({allAdmins.length})</h2>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  Admins can never self-escalate, alter CEO status, or view this directory.
                </p>
              </div>
            </div>
            <div className="divide-y divide-zinc-200 dark:divide-white/5">
              {allAdmins.length === 0 ? (
                <div className="p-8 text-center text-xs text-zinc-600 dark:text-zinc-400">
                  No regular Administrators assigned yet.
                </div>
              ) : (
                allAdmins.map((adm) => {
                  const isSelf = adm.uid === user.uid;
                  const activeKeys = (Object.keys(ADMIN_PERMISSION_LABELS) as AdminPermissionKey[]).filter(
                    (k) => adm.permissions?.[k]
                  );
                  return (
                    <div key={adm.uid} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-zinc-900 dark:text-white truncate">{adm.displayName || adm.uid}</span>
                          {isSelf && (
                            <span className="px-2 py-0.5 rounded bg-red-50 dark:bg-red-950 text-[#EA580C] dark:text-[#F97316] border border-red-200 dark:border-red-800/50 text-[10px] font-bold uppercase">
                              CEO Root
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400 truncate">
                          {adm.email || 'Verified account'} · {adm.uid}
                        </div>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {activeKeys.length === 0 ? (
                            <span className="text-[11px] text-zinc-500">No active permissions</span>
                          ) : (
                            activeKeys.map((k) => (
                              <span
                                key={k}
                                className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-[10px] font-semibold text-zinc-700 dark:text-zinc-200"
                              >
                                {ADMIN_PERMISSION_LABELS[k].label}
                              </span>
                            ))
                          )}
                        </div>
                      </div>

                      {!isSelf && (
                        <div className="flex items-center gap-2 shrink-0 text-xs">
                          <button
                            type="button"
                            onClick={() => {
                              setAdminTargetUid(adm.uid);
                              setAdminPermDraft(adm.permissions);
                              setAdminNotes(adm.notes || '');
                            }}
                            className="px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-800 dark:text-zinc-200 font-semibold"
                          >
                            Edit Perms
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              openConfirm(
                                {
                                  title: `Revoke Admin Role: ${adm.displayName || adm.uid}`,
                                  description: 'Removes all delegated Admin permissions immediately and downgrades account back to standard Creator/Viewer.',
                                  confirmLabel: 'Revoke Admin Role',
                                  dangerTone: 'red',
                                  defaultReason: 'Admin privileges revoked by CEO',
                                  onConfirm: async ({ reason, freshToken }) =>
                                    runWithToken(
                                      freshToken,
                                      (t) =>
                                        executeCeoAdminPermissions(t, {
                                          targetUid: adm.uid,
                                          enabled: false,
                                          reason,
                                        }).then(() => undefined),
                                      'Admin role revoked.'
                                    ),
                                },
                                true
                              )
                            }
                            className="px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-600/20 hover:bg-red-100 dark:hover:bg-red-600/30 text-red-700 dark:text-red-300 font-semibold"
                          >
                            Revoke
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB: MONETIZATION, PLATFORM REVENUE & CREATOR PAYOUTS */}
      {activeTab === 'monetization' && (
        <div className="space-y-6">
          {/* Payment Channel Readiness Banner */}
          <div
            className={`rounded-2xl border p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 ${
              monGov?.gatewayStatus.realPaymentsActive || monGov?.gatewayStatus.upiQrEnabled
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/50'
                : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-700/50'
            }`}
          >
            <div className="flex items-start gap-3">
              {monGov?.gatewayStatus.realPaymentsActive || monGov?.gatewayStatus.upiQrEnabled ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              )}
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-white">
                  Payment System Status:{' '}
                  <span className="text-emerald-700 dark:text-emerald-400">
                    {monGov?.gatewayStatus.gatewayConfigured
                      ? `ACTIVE (${monGov.gatewayStatus.provider.toUpperCase()} + UPI QR)`
                      : 'UPI QR CHECKOUT & MANUAL UTR VERIFICATION ACTIVE'}
                  </span>
                </div>
                <p className="text-xs text-zinc-700 dark:text-zinc-300 mt-0.5">
                  {monGov?.gatewayStatus.gatewayConfigured
                    ? 'Server-side HMAC verification and PhonePe/UPI QR checkout are armed. Verify submitted UTRs to activate purchases and credit creator ledgers.'
                    : 'PhonePe, Google Pay, Paytm & UPI QR payments are active. Every viewer payment remains Pending Verification until you verify its UTR below.'}
                </p>
              </div>
            </div>
            <div className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400 shrink-0">
              Pending UTRs:{' '}
              {monGov?.paymentTransactions?.filter((p) => p.status === 'pending_verification').length ?? 0} · Audit Records:{' '}
              {monGov?.monetizationTransactions.length ?? 0} tx ·{' '}
              {monGov?.paymentDisputes.filter((d) => d.status === 'open' || d.status === 'investigating').length ?? 0} open disputes
            </div>
          </div>

          {/* Revenue KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            {[
              { label: 'Creator Support Volume', value: formatInr(metrics?.totalSupportsInr ?? 0), tone: 'text-zinc-900 dark:text-white' },
              { label: 'Credited Creator Balances', value: formatInr(metrics?.totalCreatorEarningsInr ?? 0), tone: 'text-[#EA580C] dark:text-[#F97316]' },
              { label: 'Pending Payouts', value: `${formatInr(metrics?.pendingPayoutsInr ?? 0)} (${metrics?.pendingPayoutsCount ?? 0})`, tone: 'text-amber-600 dark:text-amber-400' },
              { label: 'Completed Payouts', value: formatInr(metrics?.paidPayoutsInr ?? 0), tone: 'text-emerald-600 dark:text-emerald-400' },
              { label: 'Pending QR UTRs', value: String(monGov?.paymentTransactions?.filter((p) => p.status === 'pending_verification').length ?? 0), tone: 'text-[#EA580C] dark:text-[#F97316]' },
              { label: 'Open IVT Flags', value: String(monGov?.invalidTrafficFlags.filter((f) => f.status === 'open').length ?? 0), tone: 'text-red-600 dark:text-red-400' },
            ].map((card) => (
              <div key={card.label} className="rounded-xl bg-white dark:bg-[#111115] border border-red-200 dark:border-red-900/30 p-4 space-y-1 shadow-xs dark:shadow-none">
                <div className="text-[11px] text-zinc-600 dark:text-zinc-400">{card.label}</div>
                <div className={`text-lg font-mono font-bold tabular-nums ${card.tone}`}>{card.value}</div>
              </div>
            ))}
          </div>

          {/* Monetization Governance Sub-tabs */}
          <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 dark:border-white/10 pb-3">
            {[
              { id: 'config_payouts', label: 'Rates, Eligibility & Payouts', icon: <Settings className="w-3.5 h-3.5" /> },
              {
                id: 'qr_payments',
                label: `UPI QR Verifications (${monGov?.paymentTransactions?.filter((p) => p.status === 'pending_verification').length ?? 0})`,
                icon: <QrCode className="w-3.5 h-3.5" />,
              },
              { id: 'ad_revenue', label: `Ad Revenue Share (${monGov?.adRevenueRecords.length ?? 0})`, icon: <TrendingUp className="w-3.5 h-3.5" /> },
              { id: 'ivt', label: `Invalid Traffic (${monGov?.invalidTrafficFlags.filter((f) => f.status === 'open').length ?? 0})`, icon: <AlertTriangle className="w-3.5 h-3.5" /> },
              { id: 'disputes', label: `Payment Disputes (${monGov?.paymentDisputes.length ?? 0})`, icon: <Scale className="w-3.5 h-3.5" /> },
              { id: 'brand_connect', label: `Brand Connect (${monGov?.brandApplications.length ?? 0})`, icon: <Briefcase className="w-3.5 h-3.5" /> },
            ].map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setMonSubTab(st.id as any)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors ${
                  monSubTab === st.id
                    ? 'bg-gradient-to-r from-[#DC2626] to-[#F97316] text-white'
                    : 'bg-white dark:bg-[#111115] border border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/5'
                }`}
              >
                {st.icon}
                <span>{st.label}</span>
              </button>
            ))}
          </div>

          {monSubTab === 'qr_payments' && (
            <div className="rounded-2xl bg-white dark:bg-[#111115] border border-red-200 dark:border-red-900/40 p-5 shadow-xs dark:shadow-none">
              <CeoPaymentVerificationPanel
                transactions={monGov?.paymentTransactions || []}
                onRefresh={loadTelemetry}
                onVerifyDecision={async ({ paymentId, decision, reason }) => {
                  try {
                    await runWithToken(
                      undefined,
                      async (token) => {
                        await govVerifyQrPayment(token, { paymentId, decision, reason });
                      },
                      decision === 'approve'
                        ? 'UPI payment verified, service activated & creator ledger updated.'
                        : 'UPI payment rejected.'
                    );
                  } catch (err: any) {
                    showToast(err?.message || 'Unable to verify payment.', 'error');
                  }
                }}
              />
            </div>
          )}

          {monSubTab === 'config_payouts' && (
            <>
              <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
                {/* Platform Monetization & Multi-Stream Rates Form */}
                <div className="xl:col-span-2 rounded-2xl bg-white dark:bg-[#111115] border border-red-200 dark:border-red-900/40 p-5 space-y-4 h-fit shadow-xs dark:shadow-none">
                  <div className="flex items-center gap-2">
                    <Settings className="w-4 h-4 text-[#EA580C] dark:text-[#F97316]" />
                    <h2 className="text-base font-bold text-zinc-900 dark:text-white">Revenue Share Rates & Global Settings</h2>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Ad Share (%)</label>
                      <input
                        type="number"
                        min={10}
                        max={95}
                        value={cfgAdShare}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setCfgAdShare(v);
                          setCfgRevShare(v);
                        }}
                        className="w-full rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-300 dark:border-white/15 px-3 py-2 text-sm text-zinc-900 dark:text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Membership Share (%)</label>
                      <input
                        type="number"
                        min={10}
                        max={95}
                        value={cfgMembershipShare}
                        onChange={(e) => setCfgMembershipShare(Number(e.target.value))}
                        className="w-full rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-300 dark:border-white/15 px-3 py-2 text-sm text-zinc-900 dark:text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Support Tips Share (%)</label>
                      <input
                        type="number"
                        min={10}
                        max={95}
                        value={cfgSupportShare}
                        onChange={(e) => setCfgSupportShare(Number(e.target.value))}
                        className="w-full rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-300 dark:border-white/15 px-3 py-2 text-sm text-zinc-900 dark:text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Paid Video Share (%)</label>
                      <input
                        type="number"
                        min={10}
                        max={95}
                        value={cfgPaidVideoShare}
                        onChange={(e) => setCfgPaidVideoShare(Number(e.target.value))}
                        className="w-full rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-300 dark:border-white/15 px-3 py-2 text-sm text-zinc-900 dark:text-white font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Min Payout (INR)</label>
                      <input
                        type="number"
                        min={100}
                        max={50000}
                        value={cfgMinPayout}
                        onChange={(e) => setCfgMinPayout(Number(e.target.value))}
                        className="w-full rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-300 dark:border-white/15 px-3 py-2 text-sm text-zinc-900 dark:text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Gateway Mode</label>
                      <select
                        value={cfgGatewayMode}
                        onChange={(e) => setCfgGatewayMode(e.target.value as any)}
                        className="w-full rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-300 dark:border-white/15 px-3 py-2 text-xs text-zinc-900 dark:text-white"
                      >
                        <option value="unconfigured">Unconfigured (Staging)</option>
                        <option value="test">Test / Sandbox</option>
                        <option value="live">Live (Requires Keys)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Discovery Categories (comma-separated)</label>
                    <input
                      type="text"
                      value={cfgCategoriesText}
                      onChange={(e) => setCfgCategoriesText(e.target.value)}
                      className="w-full rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-300 dark:border-white/15 px-3 py-2 text-xs text-zinc-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Regional Languages (comma-separated)</label>
                    <input
                      type="text"
                      value={cfgLanguagesText}
                      onChange={(e) => setCfgLanguagesText(e.target.value)}
                      className="w-full rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-300 dark:border-white/15 px-3 py-2 text-xs text-zinc-900 dark:text-white"
                    />
                  </div>

                  <div className="space-y-2 pt-1 text-xs text-zinc-700 dark:text-zinc-300">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={cfgEarlyBoost}
                        onChange={(e) => setCfgEarlyBoost(e.target.checked)}
                        className="accent-[#F97316]"
                      />
                      <span>Enable Early Creator Discovery Boost Program</span>
                    </label>
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={cfgMaintenance}
                        onChange={(e) => setCfgMaintenance(e.target.checked)}
                        className="accent-[#E11D48]"
                      />
                      <span>Platform Maintenance Mode (CEO Governance Switch)</span>
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      openConfirm(
                        {
                          title: 'Update Platform Monetization & Settings',
                          description: `Applies Ad ${cfgAdShare}%, Membership ${cfgMembershipShare}%, Support ${cfgSupportShare}%, Paid Video ${cfgPaidVideoShare}%, min payout ₹${cfgMinPayout}, gateway mode=${cfgGatewayMode}.`,
                          confirmLabel: 'Save Platform Settings',
                          dangerTone: 'orange',
                          defaultReason: 'CEO multi-stream monetization and configuration update',
                          onConfirm: async ({ reason, freshToken }) =>
                            runWithToken(
                              freshToken,
                              (t) =>
                                executeCeoMonetizationConfig(t, {
                                  creatorRevenueSharePercent: cfgAdShare,
                                  adSharePercent: cfgAdShare,
                                  membershipSharePercent: cfgMembershipShare,
                                  supportSharePercent: cfgSupportShare,
                                  paidVideoSharePercent: cfgPaidVideoShare,
                                  paymentGatewayMode: cfgGatewayMode,
                                  minPayoutInr: cfgMinPayout,
                                  earlyCreatorBoostEnabled: cfgEarlyBoost,
                                  maintenanceMode: cfgMaintenance,
                                  categories: cfgCategoriesText.split(',').map((s) => s.trim()).filter(Boolean),
                                  languages: cfgLanguagesText.split(',').map((s) => s.trim()).filter(Boolean),
                                  reason,
                                }).then(() => undefined),
                              'Platform monetization rates and global settings updated.'
                            ),
                        },
                        true
                      )
                    }
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#DC2626] to-[#F97316] text-xs font-bold text-white"
                  >
                    Save Platform Monetization Settings
                  </button>
                </div>

                {/* Creator Payout Requests Queue */}
                <div className="xl:col-span-3 rounded-2xl bg-white dark:bg-[#111115] border border-zinc-200 dark:border-white/10 overflow-hidden shadow-xs dark:shadow-none">
                  <div className="px-5 py-4 border-b border-zinc-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-base font-bold text-zinc-900 dark:text-white">Creator Payout Queue ({allPayouts.length})</h2>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400">Approve, settle UPI transfers, or reject creator payout requests.</p>
                    </div>
                    <div className="flex items-center gap-1 bg-zinc-100 dark:bg-black/40 p-1 rounded-xl border border-zinc-200 dark:border-white/10">
                      {(['all', 'pending', 'approved', 'paid', 'rejected'] as const).map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setPayoutStatusFilter(st)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold capitalize ${
                            payoutStatusFilter === st ? 'bg-[#DC2626] text-white' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                          }`}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="divide-y divide-zinc-200 dark:divide-white/5 max-h-[460px] overflow-y-auto">
                    {filteredPayouts.length === 0 ? (
                      <div className="p-8 text-center text-xs text-zinc-600 dark:text-zinc-400">
                        No creator payout requests in this queue.
                      </div>
                    ) : (
                      filteredPayouts.map((pay) => (
                        <div key={pay.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 text-xs">
                              <span className="font-bold text-zinc-900 dark:text-white">{pay.creatorName}</span>
                              <span className="font-mono text-[#EA580C] dark:text-[#F97316] font-bold">{formatInr(pay.amountInr)}</span>
                              <span className="uppercase text-[10px] font-semibold px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-white/10 text-zinc-700 dark:text-zinc-200">
                                {pay.status}
                              </span>
                            </div>
                            <div className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400">
                              UPI: {pay.upiId} · {pay.periodLabel || 'Current'}
                            </div>
                            {pay.notes && <div className="text-[11px] text-zinc-500">{pay.notes}</div>}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 text-xs">
                            {pay.status === 'pending' && (
                              <button
                                type="button"
                                onClick={() =>
                                  openConfirm(
                                    {
                                      title: `Approve Payout: ${pay.creatorName}`,
                                      description: `Approve payout request of ${formatInr(pay.amountInr)} to ${pay.upiId}.`,
                                      confirmLabel: 'Approve Payout',
                                      dangerTone: 'orange',
                                      defaultReason: 'CEO approved payout request after verification',
                                      onConfirm: async ({ reason, freshToken }) =>
                                        runWithToken(
                                          freshToken,
                                          (t) =>
                                            executeCeoPayoutAction(t, {
                                              payoutId: pay.id,
                                              status: 'approved',
                                              reason,
                                            }).then(() => undefined),
                                          'Payout approved.'
                                        ),
                                    },
                                    true
                                  )
                                }
                                className="px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-600/20 hover:bg-amber-100 dark:hover:bg-amber-600/30 text-amber-800 dark:text-amber-300 font-semibold"
                              >
                                Approve
                              </button>
                            )}
                            {(pay.status === 'pending' || pay.status === 'approved') && (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    openConfirm(
                                      {
                                        title: `Mark Paid: ${pay.creatorName}`,
                                        description: `Confirm ${formatInr(pay.amountInr)} settled via UPI (${pay.upiId}). Writes permanent ledger debit.`,
                                        confirmLabel: 'Mark Paid',
                                        dangerTone: 'orange',
                                        defaultReason: 'UPI transfer settled by CEO',
                                        onConfirm: async ({ reason, freshToken }) =>
                                          runWithToken(
                                            freshToken,
                                            (t) =>
                                              executeCeoPayoutAction(t, {
                                                payoutId: pay.id,
                                                status: 'paid',
                                                reason,
                                              }).then(() => undefined),
                                            'Payout marked as Paid.'
                                          ),
                                      },
                                      true
                                    )
                                  }
                                  className="px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-600/20 hover:bg-emerald-100 dark:hover:bg-emerald-600/30 text-emerald-700 dark:text-emerald-300 font-semibold"
                                >
                                  Mark Paid
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    openConfirm(
                                      {
                                        title: `Reject Payout: ${pay.creatorName}`,
                                        description: 'Reject this payout request and record an audit note.',
                                        confirmLabel: 'Reject Payout',
                                        dangerTone: 'red',
                                        onConfirm: async ({ reason, freshToken }) =>
                                          runWithToken(
                                            freshToken,
                                            (t) =>
                                              executeCeoPayoutAction(t, {
                                                payoutId: pay.id,
                                                status: 'rejected',
                                                reason,
                                              }).then(() => undefined),
                                            'Payout request rejected.'
                                          ),
                                      },
                                      true
                                    )
                                  }
                                  className="px-2.5 py-1.5 rounded-lg bg-red-50 dark:bg-red-600/20 hover:bg-red-100 dark:hover:bg-red-600/30 text-red-700 dark:text-red-300 font-semibold"
                                >
                                  Reject
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Creator Monetization Eligibility & Earnings Ledger */}
              <div className="rounded-2xl bg-white dark:bg-[#111115] border border-zinc-200 dark:border-white/10 overflow-hidden shadow-xs dark:shadow-none">
                <div className="px-5 py-4 border-b border-zinc-200 dark:border-white/10">
                  <h2 className="text-base font-bold text-zinc-900 dark:text-white">Creator Monetization & Verified Balance Ledger</h2>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">
                    CEO-exclusive control over per-creator monetization approval, verified withdrawable INR balances, and direct payouts.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-50 dark:bg-black/40 border-b border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-400">
                      <tr>
                        <th className="py-3 px-4 font-semibold">Creator</th>
                        <th className="py-3 px-4 font-semibold">UPI ID</th>
                        <th className="py-3 px-4 font-semibold">Monetization</th>
                        <th className="py-3 px-4 font-semibold">Verified Available Balance (INR)</th>
                        <th className="py-3 px-4 font-semibold text-right">CEO Ledger Controls</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-white/5">
                      {monetizationCreators.map((cr) => {
                        const draftVal =
                          creatorBalanceEdits[cr.uid] ?? String(cr.availableBalanceInr ?? cr.estimatedEarningsInr ?? 0);
                        return (
                          <tr key={cr.uid} className="hover:bg-zinc-50 dark:hover:bg-white/[0.02]">
                            <td className="py-3 px-4">
                              <div className="font-semibold text-zinc-900 dark:text-white">{cr.displayName}</div>
                              <div className="text-[11px] font-mono text-zinc-500">@{cr.handle}</div>
                            </td>
                            <td className="py-3 px-4 font-mono text-zinc-700 dark:text-zinc-300">
                              {cr.upiId || <span className="text-zinc-400 dark:text-zinc-500">Not linked</span>}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`font-semibold ${
                                  cr.monetizationEnabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                                }`}
                              >
                                {cr.monetizationEnabled ? 'Approved' : 'Disabled'}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <input
                                type="number"
                                min={0}
                                value={draftVal}
                                onChange={(e) =>
                                  setCreatorBalanceEdits((prev) => ({ ...prev, [cr.uid]: e.target.value }))
                                }
                                className="w-28 rounded-lg bg-zinc-50 dark:bg-[#09090B] border border-zinc-300 dark:border-white/15 px-2.5 py-1 font-mono text-zinc-900 dark:text-white"
                              />
                            </td>
                            <td className="py-3 px-4 text-right whitespace-nowrap space-x-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  openConfirm(
                                    {
                                      title: `${cr.monetizationEnabled ? 'Disable' : 'Approve'} Monetization: ${cr.displayName}`,
                                      description: 'Toggle monetization eligibility directly on the creator ledger.',
                                      confirmLabel: cr.monetizationEnabled ? 'Disable Monetization' : 'Approve Monetization',
                                      dangerTone: 'orange',
                                      defaultReason: cr.monetizationEnabled
                                        ? 'Monetization paused by CEO'
                                        : 'Monetization approved by CEO',
                                      onConfirm: async ({ reason, freshToken }) =>
                                        runWithToken(
                                          freshToken,
                                          (t) =>
                                            executeCeoCreatorMonetization(t, {
                                              targetUid: cr.uid,
                                              monetizationEnabled: !cr.monetizationEnabled,
                                              reason,
                                            }).then(() => undefined),
                                          'Creator monetization status updated.'
                                        ),
                                    },
                                    true
                                  )
                                }
                                className="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-white/10 hover:bg-zinc-200 dark:hover:bg-white/15 text-zinc-800 dark:text-zinc-200 font-semibold"
                              >
                                {cr.monetizationEnabled ? 'Pause Monetization' : 'Approve Monetization'}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const nextAmt = Math.max(0, Math.round(Number(draftVal || 0)));
                                  openConfirm(
                                    {
                                      title: `Update Available Balance: ${cr.displayName}`,
                                      description: `Set verified creator withdrawable balance to ${formatInr(nextAmt)}.`,
                                      confirmLabel: 'Save Balance',
                                      dangerTone: 'orange',
                                      defaultReason: 'CEO verified revenue ledger adjustment',
                                      onConfirm: async ({ reason, freshToken }) =>
                                        runWithToken(
                                          freshToken,
                                          (t) =>
                                            executeCeoCreatorMonetization(t, {
                                              targetUid: cr.uid,
                                              estimatedEarningsInr: nextAmt,
                                              reason,
                                            }).then(() => undefined),
                                          'Creator verified balance updated.'
                                        ),
                                    },
                                    true
                                  );
                                }}
                                className="px-2.5 py-1 rounded-lg bg-orange-50 dark:bg-[#F97316]/20 hover:bg-orange-100 dark:hover:bg-[#F97316]/30 text-[#EA580C] dark:text-[#FDBA74] font-semibold"
                              >
                                Save Balance
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const amt = Math.max(100, Math.round(Number(draftVal || 500)));
                                  openConfirm(
                                    {
                                      title: `Issue Direct UPI Payout: ${cr.displayName}`,
                                      description: `Record an immediate Paid payout of ${formatInr(amt)} to ${cr.upiId || 'creator UPI'}.`,
                                      confirmLabel: 'Issue Payout',
                                      dangerTone: 'orange',
                                      defaultReason: 'Direct CEO creator payout issued',
                                      onConfirm: async ({ reason, freshToken }) =>
                                        runWithToken(
                                          freshToken,
                                          (t) =>
                                            executeCeoPayoutAction(t, {
                                              creatorId: cr.uid,
                                              amountInr: amt,
                                              upiId: cr.upiId || 'ceo-direct@upi',
                                              reason,
                                            }).then(() => undefined),
                                          'Direct payout recorded.'
                                        ),
                                    },
                                    true
                                  );
                                }}
                                className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-600/20 hover:bg-emerald-100 dark:hover:bg-emerald-600/30 text-emerald-700 dark:text-emerald-300 font-semibold"
                              >
                                Direct Payout
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* SUBTAB 2: AD REVENUE SHARING */}
          {monSubTab === 'ad_revenue' && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              <div className="xl:col-span-5 rounded-2xl bg-white dark:bg-[#111115] border border-red-200 dark:border-red-900/40 p-5 space-y-4 h-fit shadow-xs dark:shadow-none">
                <h2 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#EA580C] dark:text-[#F97316]" />
                  <span>Record Video Ad Revenue Cycle</span>
                </h2>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  Net creator credit uses the configured Ad Share Rate ({cfgAdShare}%). Verified cycles automatically post a settled ledger credit.
                </p>
                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-zinc-700 dark:text-zinc-300 font-semibold mb-1">Select Video</label>
                    <select
                      value={adVideoId}
                      onChange={(e) => setAdVideoId(e.target.value)}
                      className="w-full rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-300 dark:border-white/15 px-3 py-2 text-zinc-900 dark:text-white"
                    >
                      <option value="">Choose uploaded video...</option>
                      {allVideos
                        .filter((v) => v.status !== 'removed')
                        .map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.title} · {v.creatorName}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-zinc-700 dark:text-zinc-300 font-semibold mb-1">Cycle Label</label>
                      <input
                        type="text"
                        value={adPeriod}
                        onChange={(e) => setAdPeriod(e.target.value)}
                        className="w-full rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-300 dark:border-white/15 px-3 py-2 text-zinc-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-zinc-700 dark:text-zinc-300 font-semibold mb-1">Settlement State</label>
                      <select
                        value={adInitialStatus}
                        onChange={(e) => setAdInitialStatus(e.target.value as any)}
                        className="w-full rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-300 dark:border-white/15 px-3 py-2 text-zinc-900 dark:text-white"
                      >
                        <option value="verified">Verified & Credit Creator</option>
                        <option value="pending">Pending Audit</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-zinc-700 dark:text-zinc-300 font-semibold mb-1">Valid Impr.</label>
                      <input
                        type="number"
                        min={0}
                        value={adValidImpr}
                        onChange={(e) => setAdValidImpr(Number(e.target.value))}
                        className="w-full rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-300 dark:border-white/15 px-3 py-2 font-mono text-zinc-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-zinc-700 dark:text-zinc-300 font-semibold mb-1">IVT Blocked</label>
                      <input
                        type="number"
                        min={0}
                        value={adInvalidImpr}
                        onChange={(e) => setAdInvalidImpr(Number(e.target.value))}
                        className="w-full rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-300 dark:border-white/15 px-3 py-2 font-mono text-zinc-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-zinc-700 dark:text-zinc-300 font-semibold mb-1">Gross Ad ₹</label>
                      <input
                        type="number"
                        min={0}
                        value={adGrossInr}
                        onChange={(e) => setAdGrossInr(Number(e.target.value))}
                        className="w-full rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-300 dark:border-white/15 px-3 py-2 font-mono text-zinc-900 dark:text-white"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={!adVideoId}
                    onClick={() => {
                      const vid = allVideos.find((v) => v.id === adVideoId);
                      if (!vid) return;
                      openConfirm(
                        {
                          title: `Record Ad Revenue: ${vid.title}`,
                          description: `Gross ₹${adGrossInr} (${cfgAdShare}% creator net = ₹${Math.round((adGrossInr * cfgAdShare) / 100)}) as ${adInitialStatus}.`,
                          confirmLabel: 'Post Ad Revenue',
                          dangerTone: 'orange',
                          defaultReason: `Verified ad revenue cycle (${adPeriod})`,
                          onConfirm: async ({ reason, freshToken }) =>
                            runWithToken(
                              freshToken,
                              (t) =>
                                govRecordAdRevenue(t, {
                                  action: 'record',
                                  videoId: vid.id,
                                  videoTitle: vid.title,
                                  creatorId: vid.creatorId,
                                  creatorName: vid.creatorName,
                                  periodLabel: adPeriod,
                                  validImpressions: adValidImpr,
                                  invalidImpressionsBlocked: adInvalidImpr,
                                  grossAdRevenueInr: adGrossInr,
                                  status: adInitialStatus,
                                  notes: reason,
                                }).then(() => undefined),
                              'Ad revenue record saved.'
                            ),
                        },
                        true
                      );
                    }}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#DC2626] to-[#F97316] text-xs font-bold text-white disabled:opacity-40"
                  >
                    Record Ad Revenue Cycle
                  </button>
                </div>
              </div>

              <div className="xl:col-span-7 rounded-2xl bg-white dark:bg-[#111115] border border-zinc-200 dark:border-white/10 overflow-hidden shadow-xs dark:shadow-none">
                <div className="px-5 py-4 border-b border-zinc-200 dark:border-white/10">
                  <h2 className="text-base font-bold text-zinc-900 dark:text-white">Ad Revenue Ledger ({monGov?.adRevenueRecords.length ?? 0})</h2>
                </div>
                <div className="divide-y divide-zinc-200 dark:divide-white/5 max-h-[500px] overflow-y-auto">
                  {(monGov?.adRevenueRecords || []).length === 0 ? (
                    <div className="p-8 text-center text-xs text-zinc-600 dark:text-zinc-400">No ad revenue cycles recorded yet.</div>
                  ) : (
                    monGov!.adRevenueRecords.map((rec) => (
                      <div key={rec.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div className="space-y-1 min-w-0">
                          <div className="font-semibold text-zinc-900 dark:text-white truncate">{rec.videoTitle}</div>
                          <div className="text-zinc-600 dark:text-zinc-400">
                            {rec.creatorName} · {rec.periodLabel} · Valid: <span className="font-mono">{formatCount(rec.validImpressions)}</span> · Blocked IVT:{' '}
                            <span className="font-mono text-red-600 dark:text-red-400">{formatCount(rec.invalidImpressionsBlocked)}</span>
                          </div>
                          <div className="font-mono text-[#EA580C] dark:text-[#F97316]">
                            Gross {formatInr(rec.grossAdRevenueInr)} · {rec.creatorSharePercent}% Net{' '}
                            <span className="font-bold text-zinc-900 dark:text-white">{formatInr(rec.creatorNetInr)}</span> ·{' '}
                            <span className="uppercase">{rec.status}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {rec.status !== 'verified' && (
                            <button
                              type="button"
                              onClick={() =>
                                openConfirm(
                                  {
                                    title: `Verify Ad Revenue: ${rec.videoTitle}`,
                                    description: `Mark ad revenue record ${rec.id} (${formatInr(rec.creatorNetInr)}) as verified.`,
                                    confirmLabel: 'Verify Record',
                                    dangerTone: 'orange',
                                    defaultReason: 'CEO verified ad revenue audit',
                                    onConfirm: async ({ reason, freshToken }) =>
                                      runWithToken(
                                        freshToken,
                                        (t) =>
                                          govRecordAdRevenue(t, {
                                            action: 'update_status',
                                            recordId: rec.id,
                                            status: 'verified',
                                            notes: reason,
                                          }).then(() => undefined),
                                        'Ad revenue verified.'
                                      ),
                                  },
                                  false
                                )
                              }
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-600/20 text-emerald-700 dark:text-emerald-300 font-semibold"
                            >
                              Verify
                            </button>
                          )}
                          {rec.status !== 'invalidated' && (
                            <button
                              type="button"
                              onClick={() =>
                                openConfirm(
                                  {
                                    title: `Invalidate Ad Revenue: ${rec.videoTitle}`,
                                    description: 'Invalidate this record due to policy violation or invalid traffic.',
                                    confirmLabel: 'Invalidate',
                                    dangerTone: 'red',
                                    defaultReason: 'Invalid traffic / ad fraud audit',
                                    onConfirm: async ({ reason, freshToken }) =>
                                      runWithToken(
                                        freshToken,
                                        (t) =>
                                          govRecordAdRevenue(t, {
                                            action: 'update_status',
                                            recordId: rec.id,
                                            status: 'invalidated',
                                            notes: reason,
                                          }).then(() => undefined),
                                        'Ad revenue invalidated.'
                                      ),
                                  },
                                  false
                                )
                              }
                              className="px-2.5 py-1.5 rounded-lg bg-red-50 dark:bg-red-600/20 text-red-700 dark:text-red-300 font-semibold"
                            >
                              Invalidate
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* SUBTAB 3: INVALID TRAFFIC DETECTION */}
          {monSubTab === 'ivt' && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              <div className="xl:col-span-5 rounded-2xl bg-white dark:bg-[#111115] border border-red-200 dark:border-red-900/40 p-5 space-y-4 h-fit shadow-xs dark:shadow-none">
                <h2 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
                  <span>Flag Suspicious / Invalid Traffic (IVT)</span>
                </h2>
                <div className="space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-zinc-700 dark:text-zinc-300 font-semibold mb-1">Target Type</label>
                      <select
                        value={ivtTargetType}
                        onChange={(e) => setIvtTargetType(e.target.value as any)}
                        className="w-full rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-300 dark:border-white/15 px-3 py-2 text-zinc-900 dark:text-white"
                      >
                        <option value="video">Video</option>
                        <option value="affiliate">Affiliate Link</option>
                        <option value="creator">Creator Channel</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-zinc-700 dark:text-zinc-300 font-semibold mb-1">Severity</label>
                      <select
                        value={ivtSeverity}
                        onChange={(e) => setIvtSeverity(e.target.value as any)}
                        className="w-full rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-300 dark:border-white/15 px-3 py-2 text-zinc-900 dark:text-white"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-zinc-700 dark:text-zinc-300 font-semibold mb-1">Creator</label>
                    <select
                      value={ivtCreatorId}
                      onChange={(e) => setIvtCreatorId(e.target.value)}
                      className="w-full rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-300 dark:border-white/15 px-3 py-2 text-zinc-900 dark:text-white"
                    >
                      <option value="">Select creator...</option>
                      {monetizationCreators.map((c) => (
                        <option key={c.uid} value={c.uid}>
                          {c.displayName} (@{c.handle})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-zinc-700 dark:text-zinc-300 font-semibold mb-1">Target Video / Link ID</label>
                    <input
                      type="text"
                      value={ivtTargetId}
                      onChange={(e) => setIvtTargetId(e.target.value)}
                      placeholder="Video ID, Affiliate code/ID, or Creator UID"
                      className="w-full rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-300 dark:border-white/15 px-3 py-2 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-700 dark:text-zinc-300 font-semibold mb-1">Signal Description</label>
                    <input
                      type="text"
                      value={ivtSignalType}
                      onChange={(e) => setIvtSignalType(e.target.value)}
                      className="w-full rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-300 dark:border-white/15 px-3 py-2 text-zinc-900 dark:text-white"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-zinc-700 dark:text-zinc-300 font-semibold mb-1">Suspicious Hits</label>
                      <input
                        type="number"
                        min={1}
                        value={ivtCount}
                        onChange={(e) => setIvtCount(Number(e.target.value))}
                        className="w-full rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-300 dark:border-white/15 px-3 py-2 font-mono text-zinc-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-zinc-700 dark:text-zinc-300 font-semibold mb-1">Est. Risk Impact (₹)</label>
                      <input
                        type="number"
                        min={0}
                        value={ivtImpactInr}
                        onChange={(e) => setIvtImpactInr(Number(e.target.value))}
                        className="w-full rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-300 dark:border-white/15 px-3 py-2 font-mono text-zinc-900 dark:text-white"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={!ivtCreatorId || !ivtTargetId.trim()}
                    onClick={() => {
                      const creator = monetizationCreators.find((c) => c.uid === ivtCreatorId);
                      openConfirm(
                        {
                          title: `Create IVT Investigation Flag`,
                          description: `Flag ${ivtTargetType} ${ivtTargetId} for ${creator?.displayName || ivtCreatorId}.`,
                          confirmLabel: 'Flag Invalid Traffic',
                          dangerTone: 'red',
                          defaultReason: ivtSignalType,
                          onConfirm: async ({ reason, freshToken }) =>
                            runWithToken(
                              freshToken,
                              (t) =>
                                govResolveInvalidTraffic(t, {
                                  action: 'flag',
                                  targetType: ivtTargetType,
                                  targetId: ivtTargetId.trim(),
                                  creatorId: ivtCreatorId,
                                  creatorName: creator?.displayName || 'Creator',
                                  signalType: ivtSignalType,
                                  suspiciousCount: ivtCount,
                                  estimatedImpactInr: ivtImpactInr,
                                  severity: ivtSeverity,
                                  notes: reason,
                                }).then(() => undefined),
                              'Invalid traffic flag logged.'
                            ),
                        },
                        false
                      );
                    }}
                    className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-xs font-bold text-white disabled:opacity-40"
                  >
                    Create IVT Investigation Flag
                  </button>
                </div>
              </div>

              <div className="xl:col-span-7 rounded-2xl bg-white dark:bg-[#111115] border border-zinc-200 dark:border-white/10 overflow-hidden shadow-xs dark:shadow-none">
                <div className="px-5 py-4 border-b border-zinc-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base font-bold text-zinc-900 dark:text-white">Invalid Traffic Flags ({monGov?.invalidTrafficFlags.length ?? 0})</h2>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">Confirm invalid traffic (optionally invalidate linked ad cycle) or clear false positives.</p>
                  </div>
                  <select
                    value={ivtDeductRecordId}
                    onChange={(e) => setIvtDeductRecordId(e.target.value)}
                    className="rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-300 dark:border-white/15 px-3 py-1.5 text-[11px] text-zinc-800 dark:text-zinc-300"
                  >
                    <option value="">Optional: Link Ad Record to Invalidate on Confirm</option>
                    {(monGov?.adRevenueRecords || [])
                      .filter((r) => r.status !== 'invalidated')
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.videoTitle} ({formatInr(r.creatorNetInr)})
                        </option>
                      ))}
                  </select>
                </div>
                <div className="divide-y divide-zinc-200 dark:divide-white/5 max-h-[500px] overflow-y-auto">
                  {(monGov?.invalidTrafficFlags || []).length === 0 ? (
                    <div className="p-8 text-center text-xs text-zinc-600 dark:text-zinc-400">No suspicious traffic flags detected.</div>
                  ) : (
                    monGov!.invalidTrafficFlags.map((flag) => (
                      <div key={flag.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-zinc-900 dark:text-white">{flag.creatorName}</span>
                            <span className="px-1.5 py-0.5 rounded bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 uppercase text-[10px] font-semibold">
                              {flag.severity}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-white/10 text-zinc-700 dark:text-zinc-300 uppercase text-[10px]">
                              {flag.status}
                            </span>
                          </div>
                          <div className="text-zinc-700 dark:text-zinc-300">{flag.signalType}</div>
                          <div className="font-mono text-[11px] text-zinc-600 dark:text-zinc-400">
                            [{flag.targetType}] {flag.targetId} · Hits: {flag.suspiciousCount} · Est. Impact: {formatInr(flag.estimatedImpactInr)}
                          </div>
                        </div>
                        {flag.status === 'open' && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() =>
                                openConfirm(
                                  {
                                    title: `Confirm Invalid Traffic`,
                                    description: ivtDeductRecordId
                                      ? `Confirm IVT for ${flag.creatorName} and invalidate ad record ${ivtDeductRecordId}.`
                                      : `Confirm IVT violation for ${flag.creatorName}.`,
                                    confirmLabel: 'Confirm Invalid',
                                    dangerTone: 'red',
                                    defaultReason: 'Confirmed automated/invalid traffic pattern',
                                    onConfirm: async ({ reason, freshToken }) =>
                                      runWithToken(
                                        freshToken,
                                        (t) =>
                                          govResolveInvalidTraffic(t, {
                                            action: 'resolve',
                                            flagId: flag.id,
                                            status: 'confirmed_invalid',
                                            deductRecordId: ivtDeductRecordId || undefined,
                                            notes: reason,
                                          }).then(() => undefined),
                                        'Invalid traffic confirmed.'
                                      ),
                                  },
                                  false
                                )
                              }
                              className="px-2.5 py-1.5 rounded-lg bg-red-50 dark:bg-red-600/20 text-red-700 dark:text-red-300 font-semibold"
                            >
                              Confirm Invalid
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                openConfirm(
                                  {
                                    title: `Clear Traffic Flag`,
                                    description: `Mark flag for ${flag.creatorName} as cleared.`,
                                    confirmLabel: 'Clear Flag',
                                    dangerTone: 'orange',
                                    defaultReason: 'Traffic verified organic after audit',
                                    onConfirm: async ({ reason, freshToken }) =>
                                      runWithToken(
                                        freshToken,
                                        (t) =>
                                          govResolveInvalidTraffic(t, {
                                            action: 'resolve',
                                            flagId: flag.id,
                                            status: 'cleared',
                                            notes: reason,
                                          }).then(() => undefined),
                                        'Traffic flag cleared.'
                                      ),
                                  },
                                  false
                                )
                              }
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-600/20 text-emerald-700 dark:text-emerald-300 font-semibold"
                            >
                              Clear
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* SUBTAB 4: PAYMENT DISPUTES */}
          {monSubTab === 'disputes' && (
            <div className="rounded-2xl bg-white dark:bg-[#111115] border border-zinc-200 dark:border-white/10 overflow-hidden shadow-xs dark:shadow-none">
              <div className="px-5 py-4 border-b border-zinc-200 dark:border-white/10">
                <h2 className="text-base font-bold text-zinc-900 dark:text-white">Payment Disputes & Refund Escalations ({monGov?.paymentDisputes.length ?? 0})</h2>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">Investigate viewer/creator billing tickets. Ledger refunds require CEO authorization.</p>
              </div>
              <div className="divide-y divide-zinc-200 dark:divide-white/5">
                {(monGov?.paymentDisputes || []).length === 0 ? (
                  <div className="p-8 text-center text-xs text-zinc-600 dark:text-zinc-400">No payment disputes reported.</div>
                ) : (
                  monGov!.paymentDisputes.map((d) => (
                    <div key={d.id} className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-zinc-900 dark:text-white">{d.reporterName}</span>
                          <span className="text-zinc-600 dark:text-zinc-400">vs {d.creatorName}</span>
                          <span className="font-mono font-bold text-[#EA580C] dark:text-[#F97316]">{formatInr(d.amountInr)}</span>
                          <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-white/10 text-zinc-700 dark:text-zinc-200 uppercase text-[10px]">
                            {d.category} · {d.status}
                          </span>
                        </div>
                        <div className="text-zinc-700 dark:text-zinc-300">{d.reason}</div>
                        <div className="font-mono text-[11px] text-zinc-500">Tx Ref: {d.transactionId}</div>
                        {d.resolutionNote && <div className="text-[11px] text-emerald-600 dark:text-emerald-400">Note: {d.resolutionNote}</div>}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        {d.status === 'open' && (
                          <button
                            type="button"
                            onClick={() =>
                              openConfirm(
                                {
                                  title: `Mark Investigating`,
                                  description: `Move dispute ${d.id} into active investigation.`,
                                  confirmLabel: 'Start Investigation',
                                  dangerTone: 'orange',
                                  defaultReason: 'CEO opened formal billing investigation',
                                  onConfirm: async ({ reason, freshToken }) =>
                                    runWithToken(
                                      freshToken,
                                      (t) =>
                                        govResolveDispute(t, {
                                          disputeId: d.id,
                                          status: 'investigating',
                                          resolutionNote: reason,
                                        }).then(() => undefined),
                                      'Dispute marked investigating.'
                                    ),
                                },
                                false
                              )
                            }
                            className="px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-600/20 text-amber-800 dark:text-amber-300 font-semibold"
                          >
                            Investigate
                          </button>
                        )}
                        {(d.status === 'open' || d.status === 'investigating') && (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                openConfirm(
                                  {
                                    title: `Resolve Dispute`,
                                    description: `Resolve dispute ${d.id} cleanly.`,
                                    confirmLabel: 'Resolve',
                                    dangerTone: 'orange',
                                    defaultReason: 'Dispute resolved after payment audit',
                                    onConfirm: async ({ reason, freshToken }) =>
                                      runWithToken(
                                        freshToken,
                                        (t) =>
                                          govResolveDispute(t, {
                                            disputeId: d.id,
                                            status: 'resolved',
                                            resolutionNote: reason,
                                          }).then(() => undefined),
                                        'Dispute resolved.'
                                      ),
                                  },
                                  false
                                )
                              }
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-600/20 text-emerald-700 dark:text-emerald-300 font-semibold"
                            >
                              Resolve
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                openConfirm(
                                  {
                                    title: `Authorize Refund (CEO)`,
                                    description: `Mark dispute ${d.id} (${formatInr(d.amountInr)}) as Refunded.`,
                                    confirmLabel: 'Issue Refund',
                                    dangerTone: 'red',
                                    defaultReason: 'CEO authorized refund settlement',
                                    onConfirm: async ({ reason, freshToken }) =>
                                      runWithToken(
                                        freshToken,
                                        (t) =>
                                          govResolveDispute(t, {
                                            disputeId: d.id,
                                            status: 'refunded',
                                            resolutionNote: reason,
                                          }).then(() => undefined),
                                        'Dispute marked refunded.'
                                      ),
                                  },
                                  true
                                )
                              }
                              className="px-2.5 py-1.5 rounded-lg bg-red-50 dark:bg-red-600/20 text-red-700 dark:text-red-300 font-semibold"
                            >
                              Refund (CEO)
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                openConfirm(
                                  {
                                    title: `Reject Dispute`,
                                    description: `Reject dispute claim ${d.id}.`,
                                    confirmLabel: 'Reject Claim',
                                    dangerTone: 'red',
                                    defaultReason: 'Claim rejected with valid delivery proof',
                                    onConfirm: async ({ reason, freshToken }) =>
                                      runWithToken(
                                        freshToken,
                                        (t) =>
                                          govResolveDispute(t, {
                                            disputeId: d.id,
                                            status: 'rejected',
                                            resolutionNote: reason,
                                          }).then(() => undefined),
                                        'Dispute rejected.'
                                      ),
                                  },
                                  false
                                )
                              }
                              className="px-2.5 py-1.5 rounded-lg bg-zinc-100 dark:bg-white/10 text-zinc-700 dark:text-zinc-300 font-semibold"
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* SUBTAB 5: BHARATPLAY BRAND CONNECT */}
          {monSubTab === 'brand_connect' && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              <div className="xl:col-span-5 rounded-2xl bg-white dark:bg-[#111115] border border-red-200 dark:border-red-900/40 p-5 space-y-4 h-fit shadow-xs dark:shadow-none">
                <h2 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-[#EA580C] dark:text-[#F97316]" />
                  <span>Publish Brand Connect Campaign</span>
                </h2>
                <div className="space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-zinc-700 dark:text-zinc-300 font-semibold mb-1">Brand Name</label>
                      <input
                        type="text"
                        value={bcBrandName}
                        onChange={(e) => setBcBrandName(e.target.value)}
                        placeholder="e.g., Boat Lifestyle"
                        className="w-full rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-300 dark:border-white/15 px-3 py-2 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500"
                      />
                    </div>
                    <div>
                      <label className="block text-zinc-700 dark:text-zinc-300 font-semibold mb-1">Budget (INR)</label>
                      <input
                        type="number"
                        min={500}
                        value={bcBudgetInr}
                        onChange={(e) => setBcBudgetInr(Number(e.target.value))}
                        className="w-full rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-300 dark:border-white/15 px-3 py-2 font-mono text-zinc-900 dark:text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-zinc-700 dark:text-zinc-300 font-semibold mb-1">Campaign Title</label>
                    <input
                      type="text"
                      value={bcTitle}
                      onChange={(e) => setBcTitle(e.target.value)}
                      placeholder="Creator Sponsorship Brief"
                      className="w-full rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-300 dark:border-white/15 px-3 py-2 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-zinc-700 dark:text-zinc-300 font-semibold mb-1">Category</label>
                      <input
                        type="text"
                        value={bcCategory}
                        onChange={(e) => setBcCategory(e.target.value)}
                        className="w-full rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-300 dark:border-white/15 px-3 py-2 text-zinc-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-zinc-700 dark:text-zinc-300 font-semibold mb-1">Deadline</label>
                      <input
                        type="date"
                        value={bcDeadline}
                        onChange={(e) => setBcDeadline(e.target.value)}
                        className="w-full rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-300 dark:border-white/15 px-3 py-2 text-zinc-900 dark:text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-zinc-700 dark:text-zinc-300 font-semibold mb-1">Deliverables</label>
                    <input
                      type="text"
                      value={bcDeliverables}
                      onChange={(e) => setBcDeliverables(e.target.value)}
                      className="w-full rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-300 dark:border-white/15 px-3 py-2 text-zinc-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-700 dark:text-zinc-300 font-semibold mb-1">Brief Description</label>
                    <textarea
                      rows={2}
                      value={bcDesc}
                      onChange={(e) => setBcDesc(e.target.value)}
                      placeholder="Eligibility and brand guidelines..."
                      className="w-full rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-300 dark:border-white/15 px-3 py-2 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={!bcBrandName.trim() || !bcTitle.trim()}
                    onClick={() =>
                      openConfirm(
                        {
                          title: `Publish Campaign: ${bcTitle}`,
                          description: `Make sponsorship campaign from ${bcBrandName} (${formatInr(bcBudgetInr)}) visible to creators.`,
                          confirmLabel: 'Publish Campaign',
                          dangerTone: 'orange',
                          defaultReason: `Launch Brand Connect campaign (${bcBrandName})`,
                          onConfirm: async ({ freshToken }) => {
                            await runWithToken(
                              freshToken,
                              (t) =>
                                govBrandConnectAction(t, {
                                  action: 'create_campaign',
                                  brandName: bcBrandName.trim(),
                                  title: bcTitle.trim(),
                                  description: bcDesc.trim() || 'Official BharatPlay Brand Connect collaboration',
                                  budgetInr: bcBudgetInr,
                                  category: bcCategory,
                                  deliverables: bcDeliverables,
                                  deadline: bcDeadline,
                                }).then(() => undefined),
                              'Brand Connect campaign published.'
                            );
                            setBcBrandName('');
                            setBcTitle('');
                            setBcDesc('');
                          },
                        },
                        false
                      )
                    }
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#DC2626] to-[#F97316] text-xs font-bold text-white disabled:opacity-40"
                  >
                    Publish Brand Campaign
                  </button>
                </div>
              </div>

              <div className="xl:col-span-7 space-y-4">
                {/* Active Campaigns */}
                <div className="rounded-2xl bg-white dark:bg-[#111115] border border-zinc-200 dark:border-white/10 overflow-hidden shadow-xs dark:shadow-none">
                  <div className="px-5 py-3.5 border-b border-zinc-200 dark:border-white/10">
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Published Campaigns ({monGov?.brandCampaigns.length ?? 0})</h3>
                  </div>
                  <div className="divide-y divide-zinc-200 dark:divide-white/5 max-h-[220px] overflow-y-auto">
                    {(monGov?.brandCampaigns || []).map((cmp) => (
                      <div key={cmp.id} className="p-3.5 flex items-center justify-between gap-3 text-xs">
                        <div className="min-w-0">
                          <div className="font-bold text-zinc-900 dark:text-white truncate">
                            {cmp.brandName} · {cmp.title}
                          </div>
                          <div className="text-zinc-600 dark:text-zinc-400 font-mono">
                            {formatInr(cmp.budgetInr)} · {cmp.category} · Due {cmp.deadline} ·{' '}
                            <span className="uppercase text-[#EA580C] dark:text-[#F97316]">{cmp.status}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            openConfirm(
                              {
                                title: `${cmp.status === 'open' ? 'Close' : 'Reopen'} Campaign`,
                                description: `Toggle status for ${cmp.title}.`,
                                confirmLabel: cmp.status === 'open' ? 'Close Campaign' : 'Reopen Campaign',
                                dangerTone: 'orange',
                                defaultReason: 'Campaign lifecycle update',
                                onConfirm: async ({ freshToken }) =>
                                  runWithToken(
                                    freshToken,
                                    (t) =>
                                      govBrandConnectAction(t, {
                                        action: 'update_campaign',
                                        campaignId: cmp.id,
                                        campaignStatus: cmp.status === 'open' ? 'closed' : 'open',
                                      }).then(() => undefined),
                                    'Campaign status updated.'
                                  ),
                              },
                              false
                            )
                          }
                          className="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-white/10 hover:bg-zinc-200 dark:hover:bg-white/15 text-zinc-800 dark:text-zinc-200 font-semibold shrink-0"
                        >
                          {cmp.status === 'open' ? 'Close' : 'Reopen'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Creator Sponsorship Applications */}
                <div className="rounded-2xl bg-white dark:bg-[#111115] border border-zinc-200 dark:border-white/10 overflow-hidden shadow-xs dark:shadow-none">
                  <div className="px-5 py-3.5 border-b border-zinc-200 dark:border-white/10">
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Creator Sponsorship Applications ({monGov?.brandApplications.length ?? 0})</h3>
                  </div>
                  <div className="divide-y divide-zinc-200 dark:divide-white/5 max-h-[300px] overflow-y-auto">
                    {(monGov?.brandApplications || []).length === 0 ? (
                      <div className="p-6 text-center text-xs text-zinc-600 dark:text-zinc-400">No creator applications submitted yet.</div>
                    ) : (
                      monGov!.brandApplications.map((app) => (
                        <div key={app.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                          <div className="space-y-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-zinc-900 dark:text-white">{app.creatorName}</span>
                              <span className="text-zinc-600 dark:text-zinc-400">→ {app.campaignTitle}</span>
                              <span className="font-mono text-[#EA580C] dark:text-[#F97316] font-bold">{formatInr(app.proposedFeeInr)}</span>
                              <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-white/10 text-zinc-700 dark:text-zinc-200 uppercase text-[10px]">{app.status}</span>
                            </div>
                            <div className="text-zinc-600 dark:text-zinc-400">{app.pitch}</div>
                            {app.deliverableUrl && (
                              <div className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400 truncate">
                                Deliverable: {app.deliverableUrl}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                            {app.status === 'applied' && (
                              <button
                                type="button"
                                onClick={() =>
                                  openConfirm(
                                    {
                                      title: `Shortlist Application`,
                                      description: `Shortlist ${app.creatorName} for ${app.campaignTitle}.`,
                                      confirmLabel: 'Shortlist',
                                      dangerTone: 'orange',
                                      defaultReason: 'Shortlisted for Brand Connect collaboration',
                                      onConfirm: async ({ reason, freshToken }) =>
                                        runWithToken(
                                          freshToken,
                                          (t) =>
                                            govBrandConnectAction(t, {
                                              action: 'review_application',
                                              applicationId: app.id,
                                              appStatus: 'shortlisted',
                                              reviewNotes: reason,
                                            }).then(() => undefined),
                                          'Application shortlisted.'
                                        ),
                                    },
                                    false
                                  )
                                }
                                className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-600/20 text-amber-800 dark:text-amber-300 font-semibold"
                              >
                                Shortlist
                              </button>
                            )}
                            {(app.status === 'applied' || app.status === 'shortlisted') && (
                              <button
                                type="button"
                                onClick={() =>
                                  openConfirm(
                                    {
                                      title: `Approve Sponsorship Collaboration`,
                                      description: `Approve ${app.creatorName} so they can submit their deliverable URL.`,
                                      confirmLabel: 'Approve Creator',
                                      dangerTone: 'orange',
                                      defaultReason: 'Sponsorship collaboration approved',
                                      onConfirm: async ({ reason, freshToken }) =>
                                        runWithToken(
                                          freshToken,
                                          (t) =>
                                            govBrandConnectAction(t, {
                                              action: 'review_application',
                                              applicationId: app.id,
                                              appStatus: 'approved',
                                              reviewNotes: reason,
                                            }).then(() => undefined),
                                          'Collaboration approved.'
                                        ),
                                    },
                                    false
                                  )
                                }
                                className="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-white/10 text-zinc-900 dark:text-white font-semibold"
                              >
                                Approve
                              </button>
                            )}
                            {(app.status === 'approved' || app.status === 'delivered') && (
                              <button
                                type="button"
                                onClick={() =>
                                  openConfirm(
                                    {
                                      title: `Settle Sponsorship Payout (90% Creator Net)`,
                                      description: `Credit ${formatInr(Math.round(app.proposedFeeInr * 0.9))} (after 10% Brand Connect fee) to ${app.creatorName}'s verified ledger.`,
                                      confirmLabel: 'Settle Payout',
                                      dangerTone: 'orange',
                                      defaultReason: 'Verified sponsorship deliverables settled by CEO',
                                      onConfirm: async ({ reason, freshToken }) =>
                                        runWithToken(
                                          freshToken,
                                          (t) =>
                                            govBrandConnectAction(t, {
                                              action: 'review_application',
                                              applicationId: app.id,
                                              appStatus: 'paid',
                                              reviewNotes: reason,
                                            }).then(() => undefined),
                                          'Sponsorship payout credited.'
                                        ),
                                    },
                                    true
                                  )
                                }
                                className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-600/20 text-emerald-700 dark:text-emerald-300 font-semibold"
                              >
                                Settle 90% Payout
                              </button>
                            )}
                            {app.status !== 'paid' && app.status !== 'rejected' && (
                              <button
                                type="button"
                                onClick={() =>
                                  openConfirm(
                                    {
                                      title: `Reject Brand Application`,
                                      description: `Decline ${app.creatorName}'s pitch.`,
                                      confirmLabel: 'Reject',
                                      dangerTone: 'red',
                                      defaultReason: 'Pitch did not match campaign requirements',
                                      onConfirm: async ({ reason, freshToken }) =>
                                        runWithToken(
                                          freshToken,
                                          (t) =>
                                            govBrandConnectAction(t, {
                                              action: 'review_application',
                                              applicationId: app.id,
                                              appStatus: 'rejected',
                                              reviewNotes: reason,
                                            }).then(() => undefined),
                                          'Application rejected.'
                                        ),
                                    },
                                    false
                                  )
                                }
                                className="px-2.5 py-1 rounded-lg bg-red-50 dark:bg-red-600/20 text-red-700 dark:text-red-300 font-semibold"
                              >
                                Reject
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
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
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-[#111115] border border-zinc-300 dark:border-white/15 focus:border-[#F97316] text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-[#111115] p-1 rounded-xl border border-zinc-200 dark:border-white/10">
              {(['all', 'active', 'suspended', 'deleted'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setChannelStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize whitespace-nowrap ${
                    channelStatusFilter === st
                      ? 'bg-[#DC2626] text-white'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            <div className="xl:col-span-2 rounded-2xl bg-white dark:bg-[#111115] border border-zinc-200 dark:border-white/10 overflow-hidden shadow-xs dark:shadow-none">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-50 dark:bg-black/40 border-b border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-400">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Channel</th>
                      <th className="py-3 px-4 font-semibold">Status</th>
                      <th className="py-3 px-4 font-semibold text-right">Subscribers</th>
                      <th className="py-3 px-4 font-semibold text-right">Views</th>
                      <th className="py-3 px-4 font-semibold text-right">Governance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-white/5">
                    {channelsList.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-10 text-center text-zinc-600 dark:text-zinc-400">
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
                            className={`cursor-pointer hover:bg-zinc-50 dark:hover:bg-white/[0.03] ${
                              selectedChannel?.uid === ch.uid ? 'bg-red-50 dark:bg-red-950/20' : ''
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
                                  <div className="font-semibold text-zinc-900 dark:text-white flex items-center gap-1.5 truncate">
                                    <span className="truncate">{ch.displayName}</span>
                                    {ch.isVerified && <BadgeCheck className="w-3.5 h-3.5 text-[#EA580C] dark:text-[#F97316] shrink-0" />}
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
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : cStatus === 'suspended'
                                    ? 'text-amber-600 dark:text-amber-400'
                                    : 'text-red-600 dark:text-red-400'
                                }`}
                              >
                                {cStatus}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-mono tabular-nums text-zinc-800 dark:text-zinc-200">
                              {formatCount(ch.subscribersCount || 0)}
                            </td>
                            <td className="py-3 px-4 text-right font-mono tabular-nums text-zinc-800 dark:text-zinc-200">
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
                                    className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-600/20 hover:bg-emerald-100 dark:hover:bg-emerald-600/30 text-emerald-700 dark:text-emerald-300 font-semibold"
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
                                    className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-600/20 hover:bg-amber-100 dark:hover:bg-amber-600/30 text-amber-800 dark:text-amber-300 font-semibold disabled:opacity-40"
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
                                    className="px-2.5 py-1 rounded-lg bg-red-50 dark:bg-red-600/20 hover:bg-red-100 dark:hover:bg-red-600/30 text-red-700 dark:text-red-300 font-semibold disabled:opacity-40"
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
            <div className="rounded-2xl bg-white dark:bg-[#111115] border border-red-200 dark:border-red-900/35 p-5 space-y-4 shadow-xs dark:shadow-none">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Channel & Owner Details</h3>
              {!selectedChannel ? (
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
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
                      <div className="text-sm font-bold text-zinc-900 dark:text-white truncate">{selectedChannel.displayName}</div>
                      <div className="font-mono text-zinc-600 dark:text-zinc-400 truncate">@{selectedChannel.handle}</div>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-white/10">
                    <div className="flex justify-between gap-2">
                      <span className="text-zinc-600 dark:text-zinc-400">Channel / Owner UID</span>
                      <span className="font-mono text-zinc-800 dark:text-zinc-200 truncate">{selectedChannel.uid}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-zinc-600 dark:text-zinc-400">Owner Email</span>
                      <span className="font-mono text-zinc-800 dark:text-zinc-200 truncate">{selectedChannel.email || 'System / Unlinked'}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-zinc-600 dark:text-zinc-400">Channel Status</span>
                      <span className="font-semibold text-zinc-900 dark:text-white capitalize">
                        {selectedChannel.channelStatus || 'active'}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-zinc-600 dark:text-zinc-400">Owner Account Status</span>
                      <span className="font-semibold text-zinc-900 dark:text-white capitalize">
                        {selectedChannel.accountStatus || 'active'}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-zinc-600 dark:text-zinc-400">Primary Language</span>
                      <span className="text-zinc-800 dark:text-zinc-200">{selectedChannel.preferredLanguage || 'Hindi'}</span>
                    </div>
                  </div>

                  {selectedChannel.moderationReason && (
                    <div className="rounded-xl bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/10 p-3 text-zinc-700 dark:text-zinc-300">
                      <span className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                        Last Governance Reason
                      </span>
                      {selectedChannel.moderationReason}
                    </div>
                  )}

                  <div className="flex flex-col gap-2 pt-2 border-t border-zinc-200 dark:border-white/10">
                    <button
                      type="button"
                      onClick={() => onOpenChannel(selectedChannel.uid)}
                      className="w-full py-2 rounded-xl bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-900 dark:text-white font-semibold"
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
                        className="w-full py-2 rounded-xl bg-red-50 dark:bg-red-950/70 hover:bg-red-100 dark:hover:bg-red-900/80 border border-red-200 dark:border-red-800/70 text-red-700 dark:text-red-200 font-semibold"
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
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-[#111115] border border-zinc-300 dark:border-white/15 focus:border-[#F97316] text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-[#111115] p-1 rounded-xl border border-zinc-200 dark:border-white/10">
              {(['all', 'published', 'flagged', 'removed'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setVideoStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize whitespace-nowrap ${
                    videoStatusFilter === st
                      ? 'bg-[#DC2626] text-white'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            <div className="xl:col-span-2 rounded-2xl bg-white dark:bg-[#111115] border border-zinc-200 dark:border-white/10 overflow-hidden shadow-xs dark:shadow-none">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-50 dark:bg-black/40 border-b border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-400">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Video</th>
                      <th className="py-3 px-4 font-semibold">Creator</th>
                      <th className="py-3 px-4 font-semibold">Status</th>
                      <th className="py-3 px-4 font-semibold text-right">Views</th>
                      <th className="py-3 px-4 font-semibold text-right">Controls</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-white/5">
                    {filteredVideos.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-10 text-center text-zinc-600 dark:text-zinc-400">
                          No videos found matching this filter.
                        </td>
                      </tr>
                    ) : (
                      filteredVideos.map((vid) => (
                        <tr
                          key={vid.id}
                          onClick={() => setSelectedVideo(vid)}
                          className={`cursor-pointer hover:bg-zinc-50 dark:hover:bg-white/[0.03] ${
                            selectedVideo?.id === vid.id ? 'bg-red-50 dark:bg-red-950/20' : ''
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
                                <div className="font-semibold text-zinc-900 dark:text-white truncate">{vid.title}</div>
                                <div className="text-[11px] font-mono text-zinc-500 truncate">
                                  {vid.id} · {vid.language}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-zinc-800 dark:text-zinc-200 font-medium">{vid.creatorName}</div>
                            <div className="text-[11px] font-mono text-zinc-500">{vid.creatorId}</div>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`font-semibold capitalize ${
                                vid.status === 'published'
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : vid.status === 'flagged'
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-red-600 dark:text-red-400'
                              }`}
                            >
                              {vid.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-zinc-800 dark:text-zinc-200">
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
                                  className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-600/20 hover:bg-amber-100 dark:hover:bg-amber-600/30 text-amber-800 dark:text-amber-300 font-semibold"
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
                                  className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-600/20 hover:bg-emerald-100 dark:hover:bg-emerald-600/30 text-emerald-700 dark:text-emerald-300 font-semibold"
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
              <div className="rounded-2xl bg-white dark:bg-[#111115] border border-red-200 dark:border-red-900/35 p-5 space-y-3 text-xs shadow-xs dark:shadow-none">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Video Details</h3>
                {!selectedVideo ? (
                  <p className="text-zinc-600 dark:text-zinc-400">
                    Click any video row to inspect creator identity, removal reason, or trigger permanent deletion.
                  </p>
                ) : (
                  <div className="space-y-3">
                    <div className="font-semibold text-sm text-zinc-900 dark:text-white">{selectedVideo.title}</div>
                    <div className="space-y-1.5 text-zinc-700 dark:text-zinc-300">
                      <div>Creator: <span className="text-zinc-900 dark:text-white font-semibold">{selectedVideo.creatorName}</span></div>
                      <div>Creator ID: <span className="font-mono text-zinc-500 dark:text-zinc-400">{selectedVideo.creatorId}</span></div>
                      <div>Category / Language: {selectedVideo.category} · {selectedVideo.language}</div>
                      <div>Views / Likes / Shares: <span className="font-mono tabular-nums">{selectedVideo.viewsCount} / {selectedVideo.likesCount} / {selectedVideo.sharesCount || 0}</span></div>
                    </div>
                    {selectedVideo.removalReason && (
                      <div className="rounded-xl bg-red-50 dark:bg-black/40 border border-red-200 dark:border-white/10 p-3 text-red-700 dark:text-red-200">
                        Removal Reason: {selectedVideo.removalReason}
                      </div>
                    )}
                    <div className="flex flex-col gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => onWatchVideo(selectedVideo)}
                        className="w-full py-2 rounded-xl bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-900 dark:text-white font-semibold"
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
                        className="w-full py-2 rounded-xl bg-red-50 dark:bg-red-950/70 hover:bg-red-100 dark:hover:bg-red-900/80 border border-red-200 dark:border-red-800/70 text-red-700 dark:text-red-200 font-semibold"
                      >
                        Permanent Delete Video
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Reported Videos Queue */}
              <div className="rounded-2xl bg-white dark:bg-[#111115] border border-zinc-200 dark:border-white/10 p-5 space-y-3 shadow-xs dark:shadow-none">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Reported Videos</h3>
                  <span className="text-xs font-mono text-amber-600 dark:text-amber-400 tabular-nums">
                    {videoReports.filter((r) => r.status === 'pending').length} pending
                  </span>
                </div>
                {videoReports.length === 0 ? (
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">No video moderation reports submitted.</p>
                ) : (
                  <div className="space-y-2.5 max-h-72 overflow-y-auto">
                    {videoReports.map((rep) => (
                      <div key={rep.id} className="rounded-xl bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/10 p-3 space-y-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-zinc-900 dark:text-white truncate">
                            {rep.targetTitle || rep.targetId}
                          </span>
                          <span className="capitalize text-amber-700 dark:text-amber-300 font-semibold">{rep.status}</span>
                        </div>
                        <p className="text-zinc-600 dark:text-zinc-400">{rep.reason}</p>
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
                              className="px-2.5 py-1 rounded-lg bg-red-50 dark:bg-red-600/25 hover:bg-red-100 dark:hover:bg-red-600/35 text-red-700 dark:text-red-200 font-semibold"
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
                              className="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-white/10 hover:bg-zinc-200 dark:hover:bg-white/15 text-zinc-800 dark:text-zinc-200 font-semibold"
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
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-[#111115] border border-zinc-300 dark:border-white/15 focus:border-[#F97316] text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-[#111115] p-1 rounded-xl border border-zinc-200 dark:border-white/10">
              {(['all', 'active', 'suspended', 'deleted'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setUserFilter(st)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize whitespace-nowrap ${
                    userFilter === st
                      ? 'bg-[#DC2626] text-white'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            <div className="xl:col-span-2 rounded-2xl bg-white dark:bg-[#111115] border border-zinc-200 dark:border-white/10 overflow-hidden shadow-xs dark:shadow-none">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-50 dark:bg-black/40 border-b border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-400">
                    <tr>
                      <th className="py-3 px-4 font-semibold">User</th>
                      <th className="py-3 px-4 font-semibold">Role</th>
                      <th className="py-3 px-4 font-semibold">Account Status</th>
                      <th className="py-3 px-4 font-semibold text-right">Controls</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-white/5">
                    {filteredUsers.map((u) => {
                      const aStatus = u.accountStatus || 'active';
                      const isSelf = u.uid === user.uid;
                      return (
                        <tr
                          key={u.uid}
                          onClick={() => setSelectedUser(u)}
                          className={`cursor-pointer hover:bg-zinc-50 dark:hover:bg-white/[0.03] ${
                            selectedUser?.uid === u.uid ? 'bg-red-50 dark:bg-red-950/20' : ''
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
                                <div className="font-semibold text-zinc-900 dark:text-white truncate">{u.displayName}</div>
                                <div className="text-[11px] font-mono text-zinc-500 truncate">
                                  {u.email || `@${u.handle}`} · {u.uid}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-mono font-semibold text-zinc-800 dark:text-zinc-200 uppercase">
                              {u.role || (u.isCreator ? 'creator' : 'viewer')}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`font-semibold capitalize ${
                                aStatus === 'active'
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : aStatus === 'suspended'
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-red-600 dark:text-red-400'
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
                                  className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-600/20 hover:bg-amber-100 dark:hover:bg-amber-600/30 text-amber-800 dark:text-amber-300 font-semibold disabled:opacity-40"
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
                                  className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-600/20 hover:bg-emerald-100 dark:hover:bg-emerald-600/30 text-emerald-700 dark:text-emerald-300 font-semibold"
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
                                className="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-white/10 hover:bg-zinc-200 dark:hover:bg-white/15 text-zinc-800 dark:text-zinc-200 font-semibold disabled:opacity-40"
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
              <div className="rounded-2xl bg-white dark:bg-[#111115] border border-red-200 dark:border-red-900/35 p-5 space-y-3 text-xs shadow-xs dark:shadow-none">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Account Governance</h3>
                {!selectedUser ? (
                  <p className="text-zinc-600 dark:text-zinc-400">
                    Select any user row to view full profile, manage admin permissions, or execute soft/permanent account deletion.
                  </p>
                ) : (
                  <div className="space-y-3">
                    <div className="font-bold text-sm text-zinc-900 dark:text-white">{selectedUser.displayName}</div>
                    <div className="space-y-1 text-zinc-700 dark:text-zinc-300">
                      <div>Email: <span className="font-mono text-zinc-900 dark:text-white">{selectedUser.email || 'System Seed'}</span></div>
                      <div>UID: <span className="font-mono text-zinc-500 dark:text-zinc-400">{selectedUser.uid}</span></div>
                      <div>Role: <span className="font-mono uppercase text-[#EA580C] dark:text-[#F97316]">{selectedUser.role || 'viewer'}</span></div>
                      <div>Account Status: <span className="capitalize text-zinc-900 dark:text-white">{selectedUser.accountStatus || 'active'}</span></div>
                    </div>

                    {selectedUser.uid !== user.uid && (
                      <div className="flex flex-col gap-2 pt-2 border-t border-zinc-200 dark:border-white/10">
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
                          className="w-full py-2 rounded-xl bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-900 dark:text-zinc-100 font-semibold"
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
                          className="w-full py-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900/70 border border-amber-200 dark:border-amber-800/50 text-amber-800 dark:text-amber-200 font-semibold"
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
                          className="w-full py-2 rounded-xl bg-red-50 dark:bg-red-950/70 hover:bg-red-100 dark:hover:bg-red-900/80 border border-red-200 dark:border-red-800/70 text-red-700 dark:text-red-200 font-semibold"
                        >
                          Permanent Delete Account
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* User Reports */}
              <div className="rounded-2xl bg-white dark:bg-[#111115] border border-zinc-200 dark:border-white/10 p-5 space-y-3 shadow-xs dark:shadow-none">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">User Reports</h3>
                {userReports.length === 0 ? (
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">No user account reports queued.</p>
                ) : (
                  <div className="space-y-2.5 max-h-64 overflow-y-auto">
                    {userReports.map((rep) => (
                      <div key={rep.id} className="rounded-xl bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/10 p-3 text-xs space-y-1.5">
                        <div className="flex justify-between font-semibold text-zinc-900 dark:text-white">
                          <span>{rep.targetTitle || rep.targetId}</span>
                          <span className="capitalize text-amber-700 dark:text-amber-300">{rep.status}</span>
                        </div>
                        <p className="text-zinc-600 dark:text-zinc-400">{rep.reason}</p>
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
                              className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-600/20 text-emerald-700 dark:text-emerald-300 font-semibold"
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
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-[#111115] border border-zinc-300 dark:border-white/15 focus:border-[#F97316] text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredCreatorsForVerify.map((cr) => (
              <div
                key={cr.uid}
                className="rounded-2xl bg-white dark:bg-[#111115] border border-zinc-200 dark:border-white/10 p-4 flex flex-col justify-between gap-4 shadow-xs dark:shadow-none"
              >
                <div className="flex items-center gap-3">
                  <MediaImage
                    src={cr.avatarUrl}
                    alt={cr.displayName}
                    className="w-12 h-12 rounded-xl object-cover shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="font-bold text-zinc-900 dark:text-white flex items-center gap-1.5 truncate">
                      <span className="truncate">{cr.displayName}</span>
                      {cr.isVerified && <BadgeCheck className="w-4 h-4 text-[#EA580C] dark:text-[#F97316] shrink-0" />}
                    </div>
                    <div className="text-xs text-zinc-600 dark:text-zinc-400">
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
                        ? 'bg-orange-50 dark:bg-[#F97316]/20 border-[#F97316]/50 text-[#EA580C] dark:text-[#FDBA74]'
                        : 'bg-zinc-100 dark:bg-white/5 border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-white/10'
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
                        ? 'bg-rose-50 dark:bg-[#E11D48]/20 border-rose-300 dark:border-[#E11D48]/50 text-rose-700 dark:text-rose-200'
                        : 'bg-zinc-100 dark:bg-white/5 border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-white/10'
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
                        ? 'bg-emerald-50 dark:bg-emerald-600/20 border-emerald-300 dark:border-emerald-600/40 text-emerald-700 dark:text-emerald-300'
                        : 'bg-zinc-100 dark:bg-white/5 border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-white/10'
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
            className="lg:col-span-2 rounded-2xl bg-white dark:bg-[#111115] border border-red-200 dark:border-red-900/40 p-5 space-y-4 h-fit shadow-xs dark:shadow-none"
          >
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-white">Broadcast Global Announcement</h2>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                Appears across Notification Center and Homepage Announcement Banner for all BharatPlay users.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Announcement Title</label>
              <input
                type="text"
                required
                value={annTitle}
                onChange={(e) => setAnnTitle(e.target.value)}
                placeholder="e.g., BharatPlay Creator League Season Opens"
                className="w-full rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-300 dark:border-white/15 focus:border-[#F97316] px-3.5 py-2.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Category</label>
              <select
                value={annCategory}
                onChange={(e) => setAnnCategory(e.target.value as any)}
                className="w-full rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-300 dark:border-white/15 focus:border-[#F97316] px-3.5 py-2.5 text-sm text-zinc-900 dark:text-white focus:outline-none"
              >
                <option value="policy">Policy & Governance</option>
                <option value="feature">Platform Feature</option>
                <option value="league">Creator League</option>
                <option value="event">Official Event</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Message Body</label>
              <textarea
                rows={4}
                required
                value={annBody}
                onChange={(e) => setAnnBody(e.target.value)}
                placeholder="Write platform-wide message for Indian creators and viewers..."
                className="w-full rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-300 dark:border-white/15 focus:border-[#F97316] px-3.5 py-2.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none"
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

          <div className="lg:col-span-3 rounded-2xl bg-white dark:bg-[#111115] border border-zinc-200 dark:border-white/10 divide-y divide-zinc-200 dark:divide-white/5 shadow-xs dark:shadow-none">
            <div className="px-5 py-4">
              <h2 className="text-base font-bold text-zinc-900 dark:text-white">Active & Past Announcements</h2>
            </div>
            {allAnnouncements.length === 0 ? (
              <div className="p-8 text-center text-sm text-zinc-600 dark:text-zinc-400">
                No announcements published yet.
              </div>
            ) : (
              allAnnouncements.map((ann) => (
                <div key={ann.id} className="px-5 py-4 flex items-start justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="uppercase font-bold text-[#EA580C] dark:text-[#F97316]">{ann.category}</span>
                      <span className="text-zinc-400 dark:text-zinc-500">·</span>
                      <span className={ann.isActive ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-zinc-500'}>
                        {ann.isActive ? 'Active' : 'Paused'}
                      </span>
                    </div>
                    <div className="font-semibold text-sm text-zinc-900 dark:text-white">{ann.title}</div>
                    <p className="text-xs text-zinc-700 dark:text-zinc-300">{ann.body}</p>
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
                      className="px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-800 dark:text-zinc-200 font-semibold"
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
                      className="p-1.5 rounded-lg bg-red-50 dark:bg-red-600/20 hover:bg-red-100 dark:hover:bg-red-600/30 text-red-700 dark:text-red-300"
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

      {/* TAB: PERMANENT IMMUTABLE CEO & ADMIN AUDIT LOGS */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={auditQuery}
                onChange={(e) => setAuditQuery(e.target.value)}
                placeholder="Search logs by actor, action, target ID, or reason..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-[#111115] border border-zinc-300 dark:border-white/15 focus:border-[#F97316] text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-[#111115] p-1 rounded-xl border border-zinc-200 dark:border-white/10 overflow-x-auto">
              {['all', 'admin', 'payout', 'config', 'channel', 'video', 'user', 'report', 'announcement', 'competition', 'challenge'].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setAuditTypeFilter(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize whitespace-nowrap ${
                    auditTypeFilter === t
                      ? 'bg-[#DC2626] text-white'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-white dark:bg-[#111115] border border-red-200 dark:border-red-900/35 overflow-hidden shadow-xs dark:shadow-none">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 dark:bg-black/50 border-b border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-400">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Timestamp</th>
                    <th className="py-3 px-4 font-semibold">Actor</th>
                    <th className="py-3 px-4 font-semibold">Action</th>
                    <th className="py-3 px-4 font-semibold">Target</th>
                    <th className="py-3 px-4 font-semibold">Audit Reason & Details</th>
                    <th className="py-3 px-4 font-semibold text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-white/5">
                  {filteredAuditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-zinc-600 dark:text-zinc-400">
                        No CEO or Admin audit records match your filter.
                      </td>
                    </tr>
                  ) : (
                    filteredAuditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-zinc-50 dark:hover:bg-white/[0.02]">
                        <td className="py-3 px-4 font-mono text-zinc-600 dark:text-zinc-400 whitespace-nowrap tabular-nums">
                          {formatTimestamp(log.createdAt)}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              log.actorRole === 'admin'
                                ? 'bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50'
                                : 'bg-red-50 dark:bg-red-950 text-[#EA580C] dark:text-[#F97316] border border-red-200 dark:border-red-800/50'
                            }`}
                          >
                            {log.actorRole || 'ceo'}
                          </span>
                          {log.actorEmail && (
                            <div className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 mt-0.5">{log.actorEmail}</div>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold text-[#EA580C] dark:text-[#F97316] whitespace-nowrap">
                          {log.action}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-zinc-900 dark:text-white">{log.targetLabel || log.targetId}</div>
                          <div className="text-[11px] font-mono text-zinc-500">
                            {log.targetType} · {log.targetId}
                          </div>
                        </td>
                        <td className="py-3 px-4 max-w-md">
                          <div className="text-zinc-800 dark:text-zinc-200">{log.reason}</div>
                          {log.details && <div className="text-[11px] text-zinc-500 mt-0.5">{log.details}</div>}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold uppercase">
                          <span
                            className={
                              log.status === 'success'
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : log.status === 'blocked'
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-red-600 dark:text-red-400'
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
