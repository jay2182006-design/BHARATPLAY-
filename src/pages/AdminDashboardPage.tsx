import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Briefcase,
  CheckCircle2,
  IndianRupee,
  Lock,
  Megaphone,
  Rocket,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  Trophy,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import {
  subscribeAllUsersAdmin,
  subscribeAllVideosAdmin,
  subscribeAnnouncements,
  subscribeReportsAdmin,
} from '../lib/bharatplayService';
import {
  adminApiCreateAnnouncement,
  adminApiCreateChallenge,
  adminApiCreateCompetition,
  adminApiResolveReport,
  adminApiToggleAnnouncement,
  adminApiUpdateCategories,
  adminApiUpdateCompetition,
  adminApiUpdateCreatorFlags,
  adminApiUpdateVideoStatus,
} from '../lib/adminService';
import {
  fetchMonetizationGovernanceOverview,
  govBrandConnectAction,
  govRecordAdRevenue,
  govResolveDispute,
  govResolveInvalidTraffic,
  govVerifyQrPayment,
  type MonetizationGovernanceOverview,
} from '../lib/monetizationService';
import { CeoPaymentVerificationPanel } from '../components/CeoPaymentVerificationPanel';
import { formatCount, formatInr } from '../lib/formatters';
import {
  ADMIN_PERMISSION_LABELS,
  type AdminPermissionKey,
  type AppRoute,
  type CreatorChallenge,
  type LeagueCompetition,
  type ModerationReport,
  type PlatformAnnouncement,
  type PlatformConfig,
  type UserPublicProfile,
  type VideoItem,
} from '../types/bharatplay';

interface AdminDashboardPageProps {
  creators: UserPublicProfile[];
  challenges: CreatorChallenge[];
  competitions: LeagueCompetition[];
  platformConfig: PlatformConfig;
  onNavigate: (route: AppRoute) => void;
}

type AdminTab =
  | 'creators'
  | 'videos'
  | 'competitions'
  | 'announcements'
  | 'reports'
  | 'categories'
  | 'monetization';

const TAB_REQUIRED_PERM: Record<AdminTab, AdminPermissionKey> = {
  creators: 'manageCreators',
  videos: 'moderateVideos',
  competitions: 'manageCompetitions',
  announcements: 'manageAnnouncements',
  reports: 'resolveReports',
  categories: 'manageCategories',
  monetization: 'manageMonetization',
};

export function AdminDashboardPage({
  creators,
  challenges,
  competitions,
  platformConfig,
  onNavigate,
}: AdminDashboardPageProps) {
  const { isAdmin, isCeo, profile, getIdToken, hasAdminPermission } = useAuth();
  const { showToast } = useToast();

  const [tab, setTab] = useState<AdminTab>('creators');
  const [allUsers, setAllUsers] = useState<UserPublicProfile[]>([]);
  const [allVideos, setAllVideos] = useState<VideoItem[]>([]);
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [allAnnouncements, setAllAnnouncements] = useState<PlatformAnnouncement[]>([]);
  const [newCategory, setNewCategory] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);

  // Challenge form
  const [chgTitle, setChgTitle] = useState('');
  const [chgDesc, setChgDesc] = useState('');
  const [chgPrize, setChgPrize] = useState(50000);
  const [chgCat, setChgCat] = useState('Regional');
  const [chgDeadline, setChgDeadline] = useState('2026-12-31');

  // Competition form
  const [compTitle, setCompTitle] = useState('');
  const [compMonth, setCompMonth] = useState('December 2026');
  const [compDesc, setCompDesc] = useState('');
  const [compPrize, setCompPrize] = useState(500000);

  // Announcement form
  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');
  const [annCat, setAnnCat] = useState<'feature' | 'league' | 'policy' | 'event'>('feature');

  // Monetization Governance state (gated by `manageMonetization`)
  const [monGov, setMonGov] = useState<MonetizationGovernanceOverview | null>(null);
  const [adVideoId, setAdVideoId] = useState('');
  const [adValidImpr, setAdValidImpr] = useState(0);
  const [adInvalidImpr, setAdInvalidImpr] = useState(0);
  const [adGrossInr, setAdGrossInr] = useState(0);
  const [ivtCreatorId, setIvtCreatorId] = useState('');
  const [ivtTargetId, setIvtTargetId] = useState('');
  const [ivtSignal, setIvtSignal] = useState('Automated click burst detected');
  const [ivtCount, setIvtCount] = useState(10);
  const [bcBrand, setBcBrand] = useState('');
  const [bcTitle, setBcTitle] = useState('');
  const [bcBudget, setBcBudget] = useState(20000);
  const [bcDeliverables, setBcDeliverables] = useState('1 Sponsored Integration');
  const [bcDeadline, setBcDeadline] = useState('2026-12-31');

  const canManageMonetization = isAdmin && hasAdminPermission('manageMonetization');

  const refreshMonetizationGovernance = async () => {
    if (!canManageMonetization) return;
    try {
      const token = await getIdToken();
      if (!token) return;
      const ov = await fetchMonetizationGovernanceOverview(token);
      setMonGov(ov);
    } catch {
      // Denied or unavailable
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    const u1 = subscribeAllVideosAdmin(setAllVideos);
    const u2 = subscribeReportsAdmin(setReports);
    const u3 = subscribeAllUsersAdmin(setAllUsers);
    const u4 = subscribeAnnouncements(setAllAnnouncements, true);
    return () => {
      u1();
      u2();
      u3();
      u4();
    };
  }, [isAdmin]);

  useEffect(() => {
    refreshMonetizationGovernance();
  }, [canManageMonetization]);

  // Automatically pick first tab the admin has permission for
  useEffect(() => {
    if (!isAdmin) return;
    if (!hasAdminPermission(TAB_REQUIRED_PERM[tab])) {
      const order: AdminTab[] = [
        'creators',
        'videos',
        'reports',
        'competitions',
        'announcements',
        'categories',
        'monetization',
      ];
      const firstAllowed = order.find((t) => hasAdminPermission(TAB_REQUIRED_PERM[t]));
      if (firstAllowed) setTab(firstAllowed);
    }
  }, [isAdmin, tab, hasAdminPermission]);

  const permissionEntries = useMemo(
    () =>
      (Object.keys(ADMIN_PERMISSION_LABELS) as AdminPermissionKey[]).map((key) => ({
        key,
        ...ADMIN_PERMISSION_LABELS[key],
        granted: hasAdminPermission(key),
      })),
    [hasAdminPermission]
  );

  const runAdminMutation = async (key: string, fn: (token: string) => Promise<void>, successMsg?: string) => {
    setBusyKey(key);
    try {
      const token = await getIdToken();
      if (!token) throw new Error('Authentication token unavailable.');
      await fn(token);
      if (successMsg) showToast(successMsg, 'success');
    } catch (err: any) {
      showToast(err?.message || 'Admin action denied or failed.', 'error');
    } finally {
      setBusyKey(null);
    }
  };

  if (!isAdmin) {
    return (
      <div className="max-w-lg mx-auto my-16 p-8 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-center space-y-4">
        <ShieldAlert className="w-10 h-10 text-[#E11D48] dark:text-[#FB7185] mx-auto" />
        <h1 className="text-xl font-bold text-zinc-900 dark:text-white font-display">Admin Access Restricted</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          This area requires verified BharatPlay Administrator privileges granted exclusively by the Platform CEO and enforced by backend RBAC rules.
        </p>
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className="px-5 py-2.5 rounded-xl bg-white dark:bg-[#111115] hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-sm font-semibold text-zinc-900 dark:text-white"
        >
          Return Home
        </button>
      </div>
    );
  }

  const managedUsers = allUsers.length > 0 ? allUsers : creators;
  const totalPlatformViews = allVideos.reduce((sum, v) => sum + (v.viewsCount || 0), 0);
  const totalCreators = managedUsers.filter((c) => c.isCreator).length;
  const currentTabPermitted = hasAdminPermission(TAB_REQUIRED_PERM[tab]);

  return (
    <div className="max-w-[1440px] mx-auto px-4 md:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-6 h-6 text-[#E11D48] shrink-0" />
          <div>
            <h1 className="text-2xl font-bold font-display text-zinc-900 dark:text-white">BHARATPLAY Admin Control</h1>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Scoped moderation & operations panel · All actions are server-authorized and recorded to the permanent Audit Ledger.
            </p>
          </div>
        </div>
        <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 px-3.5 py-2 rounded-xl">
          Role: <span className="font-bold text-[#E11D48] dark:text-[#FB7185] uppercase">{isCeo ? 'CEO Override' : 'Regular Admin'}</span>
        </div>
      </div>

      {/* CEO-Granted Permission Matrix */}
      <div className="rounded-xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="text-xs font-bold text-zinc-900 dark:text-white">
            Your CEO-Granted Permissions
          </div>
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Monetization, payouts, account deletion, admin roles & CEO Command Center are strictly CEO-exclusive.
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {permissionEntries.map((perm) => (
            <span
              key={perm.key}
              title={perm.description}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-semibold border ${
                perm.granted
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-400'
                  : 'bg-white dark:bg-[#09090B] border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500'
              }`}
            >
              {perm.granted ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Lock className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
              )}
              <span>{perm.label}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Platform KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Users', value: formatCount(managedUsers.length) },
          { label: 'Total Creators', value: formatCount(totalCreators) },
          { label: 'Uploaded Videos', value: formatCount(allVideos.length) },
          { label: 'Platform Views', value: formatCount(totalPlatformViews) },
        ].map((k) => (
          <div key={k.label} className="p-5 rounded-xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800">
            <div className="text-xs text-zinc-600 dark:text-zinc-400">{k.label}</div>
            <div className="text-2xl font-bold font-mono tabular-nums text-zinc-900 dark:text-white mt-1">{k.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {(
          [
            { id: 'creators', label: 'Creator Boost & Badges' },
            { id: 'videos', label: `Content & Originals (${allVideos.length})` },
            { id: 'competitions', label: `Monthly Competitions (${competitions.length})` },
            { id: 'announcements', label: `Announcements (${allAnnouncements.length})` },
            { id: 'reports', label: `Reports (${reports.filter((r) => r.status === 'pending').length})` },
            { id: 'categories', label: 'Categories & Challenges' },
            { id: 'monetization', label: 'Monetization Governance' },
          ] as { id: AdminTab; label: string }[]
        ).map((t) => {
          const permitted = hasAdminPermission(TAB_REQUIRED_PERM[t.id]);
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                tab === t.id
                  ? 'bg-[#E11D48] text-white'
                  : permitted
                  ? 'bg-zinc-100 dark:bg-[#141418] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800'
                  : 'bg-zinc-50 dark:bg-[#111115] text-zinc-400 dark:text-zinc-500 border border-zinc-200 dark:border-zinc-800'
              }`}
            >
              {!permitted && <Lock className="w-3 h-3" />}
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {!currentTabPermitted ? (
        <div className="p-10 rounded-2xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 text-center space-y-2">
          <Lock className="w-8 h-8 text-zinc-400 dark:text-zinc-500 mx-auto" />
          <h2 className="text-base font-bold text-zinc-900 dark:text-white">Permission Not Granted by CEO</h2>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 max-w-md mx-auto">
            Your Admin account does not currently have the{' '}
            <span className="font-semibold text-zinc-900 dark:text-white">
              {ADMIN_PERMISSION_LABELS[TAB_REQUIRED_PERM[tab]].label}
            </span>{' '}
            permission. Contact the Platform CEO if you need temporary delegation for this section.
          </p>
        </div>
      ) : (
        <>
          {tab === 'creators' && (
            <div className="rounded-xl bg-white dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 dark:bg-[#141418] text-zinc-600 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
                  <tr>
                    <th className="p-4">Name</th>
                    <th className="p-4">League Track</th>
                    <th className="p-4 text-right">Subs</th>
                    <th className="p-4">Tier</th>
                    <th className="p-4 text-right">Creator Controls</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {managedUsers.map((c) => (
                    <tr key={c.uid} className="hover:bg-zinc-50 dark:hover:bg-[#16161C]">
                      <td className="p-4 font-semibold text-zinc-900 dark:text-white">
                        <div>{c.displayName}</div>
                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-normal">@{c.handle}</div>
                      </td>
                      <td className="p-4">
                        <select
                          value={c.leagueCategory || 'Entertainment'}
                          disabled={busyKey === `cr-${c.uid}`}
                          onChange={(e) =>
                            runAdminMutation(
                              `cr-${c.uid}`,
                              (t) => adminApiUpdateCreatorFlags(t, c.uid, { leagueCategory: e.target.value }).then(() => undefined),
                              'League category updated.'
                            )
                          }
                          className="px-2 py-1 rounded bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white"
                        >
                          {['Education', 'Entertainment', 'Rising Star'].map((cat) => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-4 text-right font-mono tabular-nums text-zinc-700 dark:text-zinc-300">
                        {formatCount(c.subscribersCount)}
                      </td>
                      <td className="p-4">
                        <select
                          value={c.rewardTier || 'Seed'}
                          disabled={busyKey === `cr-${c.uid}`}
                          onChange={(e) =>
                            runAdminMutation(
                              `cr-${c.uid}`,
                              (t) => adminApiUpdateCreatorFlags(t, c.uid, { rewardTier: e.target.value as any }).then(() => undefined),
                              'Creator tier updated.'
                            )
                          }
                          className="px-2 py-1 rounded bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white"
                        >
                          {['Seed', 'Rising', 'Star', 'Icon'].map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-4 text-right space-x-2 whitespace-nowrap">
                        <button
                          type="button"
                          disabled={busyKey === `cr-${c.uid}`}
                          onClick={() =>
                            runAdminMutation(
                              `cr-${c.uid}`,
                              (t) => adminApiUpdateCreatorFlags(t, c.uid, { boostEnabled: !c.boostEnabled }).then(() => undefined),
                              c.boostEnabled ? 'Creator Boost disabled' : 'Creator Boost enabled'
                            )
                          }
                          className={`px-2.5 py-1 rounded-lg ${
                            c.boostEnabled
                              ? 'bg-[#E11D48] text-white'
                              : 'bg-white dark:bg-[#141418] border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                          }`}
                        >
                          <Rocket className="w-3 h-3 inline mr-1" />
                          {c.boostEnabled ? 'Boosted' : 'Boost'}
                        </button>
                        <button
                          type="button"
                          disabled={busyKey === `cr-${c.uid}`}
                          onClick={() =>
                            runAdminMutation(
                              `cr-${c.uid}`,
                              (t) => adminApiUpdateCreatorFlags(t, c.uid, { isFeatured: !c.isFeatured }).then(() => undefined),
                              c.isFeatured ? 'Removed from Featured' : 'Added to Featured Creators'
                            )
                          }
                          className={`px-2.5 py-1 rounded-lg ${
                            c.isFeatured
                              ? 'bg-[#F97316] text-white'
                              : 'bg-white dark:bg-[#141418] border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                          }`}
                        >
                          <Star className="w-3 h-3 inline mr-1" />
                          {c.isFeatured ? 'Featured' : 'Feature'}
                        </button>
                        <button
                          type="button"
                          disabled={busyKey === `cr-${c.uid}`}
                          onClick={() =>
                            runAdminMutation(
                              `cr-${c.uid}`,
                              (t) => adminApiUpdateCreatorFlags(t, c.uid, { isVerified: !c.isVerified }).then(() => undefined),
                              'Verification badge updated.'
                            )
                          }
                          className={`px-2.5 py-1 rounded-lg ${
                            c.isVerified
                              ? 'bg-emerald-600 text-white'
                              : 'bg-white dark:bg-[#141418] border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                          }`}
                        >
                          {c.isVerified ? 'Verified' : 'Verify'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'videos' && (
            <div className="space-y-3">
              {allVideos.map((v) => (
                <div key={v.id} className="p-4 rounded-xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-zinc-900 dark:text-white truncate">{v.title}</div>
                    <div className="text-xs text-zinc-600 dark:text-zinc-400 tabular-nums">
                      {v.creatorName} · {v.status} · {formatCount(v.viewsCount)} views · {v.language}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={busyKey === `vid-${v.id}`}
                      onClick={() =>
                        runAdminMutation(
                          `vid-${v.id}`,
                          (t) =>
                            adminApiUpdateVideoStatus(t, {
                              videoId: v.id,
                              status: v.status,
                              isTrending: v.isTrending,
                              isOriginal: !v.isOriginal,
                            }).then(() => undefined),
                          v.isOriginal ? 'Removed Original tag.' : 'Marked as BharatPlay Original.'
                        )
                      }
                      className={`px-3 py-1.5 rounded-lg text-xs inline-flex items-center gap-1 ${
                        v.isOriginal
                          ? 'bg-gradient-to-r from-[#E11D48] to-[#F97316] text-white'
                          : 'bg-white dark:bg-[#141418] border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <Sparkles className="w-3 h-3" />
                      {v.isOriginal ? 'Original' : 'Mark Original'}
                    </button>
                    <button
                      type="button"
                      disabled={busyKey === `vid-${v.id}`}
                      onClick={() =>
                        runAdminMutation(
                          `vid-${v.id}`,
                          (t) =>
                            adminApiUpdateVideoStatus(t, {
                              videoId: v.id,
                              status: v.status,
                              isTrending: !v.isTrending,
                              isOriginal: v.isOriginal,
                            }).then(() => undefined),
                          v.isTrending ? 'Trending tag removed.' : 'Marked as Trending.'
                        )
                      }
                      className={`px-3 py-1.5 rounded-lg text-xs ${
                        v.isTrending
                          ? 'bg-[#F97316] text-white'
                          : 'bg-white dark:bg-[#141418] border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      {v.isTrending ? 'Trending' : 'Mark Trending'}
                    </button>
                    <button
                      type="button"
                      disabled={busyKey === `vid-${v.id}`}
                      onClick={() =>
                        runAdminMutation(
                          `vid-${v.id}`,
                          (t) =>
                            adminApiUpdateVideoStatus(t, {
                              videoId: v.id,
                              status: v.status === 'published' ? 'flagged' : 'published',
                            }).then(() => undefined),
                          v.status === 'published' ? 'Video flagged.' : 'Video restored to published.'
                        )
                      }
                      className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#141418] hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs text-zinc-800 dark:text-zinc-200"
                    >
                      {v.status === 'published' ? 'Flag' : 'Restore'}
                    </button>
                    <button
                      type="button"
                      disabled={busyKey === `vid-${v.id}`}
                      onClick={() =>
                        runAdminMutation(
                          `vid-${v.id}`,
                          (t) =>
                            adminApiUpdateVideoStatus(t, {
                              videoId: v.id,
                              status: 'removed',
                              removalReason: 'Removed by Admin content moderation',
                            }).then(() => undefined),
                          'Video soft-removed from public catalog.'
                        )
                      }
                      className="px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-950/50 border border-rose-200 dark:border-rose-900/50 text-[#BE123C] dark:text-[#FB7185] text-xs font-medium"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'competitions' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  runAdminMutation(
                    'comp-create',
                    async (t) => {
                      await adminApiCreateCompetition(t, {
                        title: compTitle,
                        monthLabel: compMonth,
                        description: compDesc,
                        prizePoolInr: compPrize,
                      });
                      setCompTitle('');
                      setCompDesc('');
                    },
                    'Monthly Creator League competition created!'
                  );
                }}
                className="lg:col-span-5 p-6 rounded-xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 space-y-4 h-fit"
              >
                <h2 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-[#EA580C] dark:text-[#F97316]" />
                  <span>Launch Monthly Competition</span>
                </h2>
                <input
                  type="text"
                  required
                  value={compTitle}
                  onChange={(e) => setCompTitle(e.target.value)}
                  placeholder="Competition title (e.g., Creator League Season 5)"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    required
                    value={compMonth}
                    onChange={(e) => setCompMonth(e.target.value)}
                    placeholder="Month (e.g., December 2026)"
                    className="px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500"
                  />
                  <input
                    type="number"
                    required
                    value={compPrize}
                    onChange={(e) => setCompPrize(Number(e.target.value))}
                    placeholder="Prize Pool INR"
                    className="px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500"
                  />
                </div>
                <textarea
                  rows={3}
                  required
                  value={compDesc}
                  onChange={(e) => setCompDesc(e.target.value)}
                  placeholder="Rules and judging criteria..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500"
                />
                <button
                  type="submit"
                  disabled={busyKey === 'comp-create'}
                  className="w-full py-2.5 rounded-xl bg-[#E11D48] hover:bg-[#BE123C] text-xs font-semibold text-white disabled:opacity-60"
                >
                  Create League Season
                </button>
              </form>

              <div className="lg:col-span-7 space-y-3">
                {competitions.map((comp) => (
                  <div key={comp.id} className="p-5 rounded-xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-bold text-zinc-900 dark:text-white">{comp.title}</div>
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${
                          comp.status === 'active'
                            ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400'
                            : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                        }`}
                      >
                        {comp.status}
                      </span>
                    </div>
                    <div className="text-xs text-[#EA580C] dark:text-[#F97316] font-mono font-semibold">
                      {comp.monthLabel} · {formatInr(comp.prizePoolInr)} Prize Pool
                    </div>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">{comp.description}</p>
                    <div className="pt-2 flex gap-2">
                      <button
                        type="button"
                        disabled={busyKey === `comp-${comp.id}`}
                        onClick={() =>
                          runAdminMutation(
                            `comp-${comp.id}`,
                            (t) =>
                              adminApiUpdateCompetition(t, comp.id, {
                                status: comp.status === 'active' ? 'completed' : 'active',
                              }).then(() => undefined),
                            'Competition status updated.'
                          )
                        }
                        className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#141418] hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs font-medium text-zinc-900 dark:text-white"
                      >
                        {comp.status === 'active' ? 'Mark Completed' : 'Reopen Season'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'announcements' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  runAdminMutation(
                    'ann-create',
                    async (t) => {
                      await adminApiCreateAnnouncement(t, {
                        title: annTitle,
                        body: annBody,
                        category: annCat,
                        createdBy: profile?.displayName || 'BHARATPLAY Admin',
                      });
                      setAnnTitle('');
                      setAnnBody('');
                    },
                    'Platform announcement published!'
                  );
                }}
                className="lg:col-span-5 p-6 rounded-xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 space-y-4 h-fit"
              >
                <h2 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-[#EA580C] dark:text-[#F97316]" />
                  <span>Broadcast Platform Announcement</span>
                </h2>
                <input
                  type="text"
                  required
                  value={annTitle}
                  onChange={(e) => setAnnTitle(e.target.value)}
                  placeholder="Announcement headline"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500"
                />
                <select
                  value={annCat}
                  onChange={(e) => setAnnCat(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-xs text-zinc-900 dark:text-white"
                >
                  <option value="feature">Feature Release</option>
                  <option value="league">Creator League</option>
                  <option value="event">Community Event</option>
                  <option value="policy">Policy Update</option>
                </select>
                <textarea
                  rows={3}
                  required
                  value={annBody}
                  onChange={(e) => setAnnBody(e.target.value)}
                  placeholder="Message shown in Notification Center..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500"
                />
                <button
                  type="submit"
                  disabled={busyKey === 'ann-create'}
                  className="w-full py-2.5 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-xs font-semibold text-white disabled:opacity-60"
                >
                  Publish Announcement
                </button>
              </form>

              <div className="lg:col-span-7 space-y-3">
                {allAnnouncements.map((a) => (
                  <div key={a.id} className="p-4 rounded-xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] uppercase font-bold text-[#EA580C] dark:text-[#F97316]">{a.category}</span>
                        <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{a.isActive ? 'Active' : 'Archived'}</span>
                      </div>
                      <div className="text-sm font-bold text-zinc-900 dark:text-white">{a.title}</div>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400">{a.body}</p>
                    </div>
                    <button
                      type="button"
                      disabled={busyKey === `ann-${a.id}`}
                      onClick={() =>
                        runAdminMutation(
                          `ann-${a.id}`,
                          (t) => adminApiToggleAnnouncement(t, a.id, !a.isActive).then(() => undefined),
                          a.isActive ? 'Announcement archived.' : 'Announcement activated.'
                        )
                      }
                      className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#141418] hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs font-medium text-zinc-900 dark:text-white shrink-0"
                    >
                      {a.isActive ? 'Archive' : 'Activate'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'reports' && (
            <div className="space-y-3">
              {reports.length === 0 ? (
                <div className="p-8 rounded-xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 text-center text-sm text-zinc-600 dark:text-zinc-400">
                  No moderation reports submitted.
                </div>
              ) : (
                reports.map((r) => (
                  <div key={r.id} className="p-4 rounded-xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-zinc-900 dark:text-white">
                        [{r.targetType}] {r.targetTitle || r.targetId}
                      </div>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">Reason: {r.reason} · Status: {r.status}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={busyKey === `rep-${r.id}`}
                        onClick={() =>
                          runAdminMutation(
                            `rep-${r.id}`,
                            (t) => adminApiResolveReport(t, r.id, 'resolved', 'Resolved by Admin').then(() => undefined),
                            'Report resolved.'
                          )
                        }
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold text-white"
                      >
                        Resolve
                      </button>
                      <button
                        type="button"
                        disabled={busyKey === `rep-${r.id}`}
                        onClick={() =>
                          runAdminMutation(
                            `rep-${r.id}`,
                            (t) => adminApiResolveReport(t, r.id, 'dismissed', 'Dismissed by Admin').then(() => undefined),
                            'Report dismissed.'
                          )
                        }
                        className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#141418] hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs text-zinc-700 dark:text-zinc-300"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === 'categories' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="p-6 rounded-xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 space-y-4">
                <h2 className="text-base font-bold text-zinc-900 dark:text-white">Manage Discovery Categories</h2>
                <div className="flex flex-wrap gap-2">
                  {platformConfig.categories.map((cat) => (
                    <div key={cat} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-[#141418] border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-white">
                      <span>{cat}</span>
                      <button
                        type="button"
                        disabled={busyKey === 'cats'}
                        onClick={() => {
                          const next = platformConfig.categories.filter((c) => c !== cat);
                          runAdminMutation(
                            'cats',
                            (t) => adminApiUpdateCategories(t, next).then(() => undefined),
                            'Category removed.'
                          );
                        }}
                        className="text-zinc-500 dark:text-zinc-400 hover:text-[#E11D48]"
                        aria-label={`Remove ${cat}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!newCategory.trim()) return;
                    const next = Array.from(new Set([...platformConfig.categories, newCategory.trim()]));
                    runAdminMutation(
                      'cats',
                      async (t) => {
                        await adminApiUpdateCategories(t, next);
                        setNewCategory('');
                      },
                      'Category added.'
                    );
                  }}
                  className="flex gap-2"
                >
                  <input
                    type="text"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="New category..."
                    className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500"
                  />
                  <button
                    type="submit"
                    disabled={busyKey === 'cats'}
                    className="px-4 py-2 rounded-xl bg-[#E11D48] hover:bg-[#BE123C] text-xs font-semibold text-white"
                  >
                    Add
                  </button>
                </form>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  runAdminMutation(
                    'chg-create',
                    async (t) => {
                      await adminApiCreateChallenge(t, {
                        title: chgTitle,
                        description: chgDesc,
                        prizePoolInr: chgPrize,
                        category: chgCat,
                        deadline: chgDeadline,
                      });
                      setChgTitle('');
                      setChgDesc('');
                    },
                    'New weekly Creator Challenge launched!'
                  );
                }}
                className="p-6 rounded-xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 space-y-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-base font-bold text-zinc-900 dark:text-white">Launch Creator Challenge ({challenges.length} active)</h2>
                  {!hasAdminPermission('manageCompetitions') && (
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400">Requires Competition perm</span>
                  )}
                </div>
                <input
                  type="text"
                  required
                  value={chgTitle}
                  onChange={(e) => setChgTitle(e.target.value)}
                  placeholder="Challenge Title"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500"
                />
                <textarea
                  rows={2}
                  required
                  value={chgDesc}
                  onChange={(e) => setChgDesc(e.target.value)}
                  placeholder="Challenge brief & criteria"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500"
                />
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="number"
                    value={chgPrize}
                    onChange={(e) => setChgPrize(Number(e.target.value))}
                    placeholder="Prize INR"
                    className="px-3 py-2 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-xs text-zinc-900 dark:text-white"
                  />
                  <input
                    type="text"
                    value={chgCat}
                    onChange={(e) => setChgCat(e.target.value)}
                    placeholder="Category"
                    className="px-3 py-2 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-xs text-zinc-900 dark:text-white"
                  />
                  <input
                    type="date"
                    value={chgDeadline}
                    onChange={(e) => setChgDeadline(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-xs text-zinc-900 dark:text-white"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busyKey === 'chg-create'}
                  className="w-full py-2.5 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-xs font-semibold text-white disabled:opacity-60"
                >
                  Launch Challenge
                </button>
              </form>
            </div>
          )}

          {tab === 'monetization' && (
            <div className="space-y-6">
              {/* Gateway & Scope Notice */}
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <IndianRupee className="w-5 h-5 text-[#EA580C] dark:text-[#F97316] shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-zinc-900 dark:text-white">
                      Payment Channel:{' '}
                      {monGov?.gatewayStatus.gatewayConfigured
                        ? `Active (${monGov.gatewayStatus.provider.toUpperCase()} + UPI QR)`
                        : 'UPI QR Checkout & Manual UTR Verification Active'}
                    </div>
                    <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-0.5">
                      Delegated governance lets you verify submitted UPI QR UTRs to activate viewer services, record pending ad cycles, flag/review invalid traffic, investigate disputes, and manage Brand Connect campaigns. Final revenue-share percentages, ledger credits, and creator payouts remain strictly CEO-exclusive.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={refreshMonetizationGovernance}
                  className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#141418] border border-zinc-300 dark:border-zinc-700 text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 shrink-0"
                >
                  Refresh Queue
                </button>
              </div>

              <div className="p-5 rounded-xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800">
                <CeoPaymentVerificationPanel
                  transactions={monGov?.paymentTransactions || []}
                  onRefresh={refreshMonetizationGovernance}
                  onVerifyDecision={async ({ paymentId, decision, reason }) => {
                    await runAdminMutation(
                      `qr-${paymentId}`,
                      async (t) => {
                        await govVerifyQrPayment(t, { paymentId, decision, reason });
                        await refreshMonetizationGovernance();
                      },
                      decision === 'approve'
                        ? 'Payment UTR verified & service activated.'
                        : 'Payment UTR rejected.'
                    );
                  }}
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Pending Ad Revenue Recording */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const vid = allVideos.find((v) => v.id === adVideoId);
                    if (!vid) return;
                    runAdminMutation(
                      'gov-ad-rec',
                      async (t) => {
                        await govRecordAdRevenue(t, {
                          action: 'record',
                          videoId: vid.id,
                          videoTitle: vid.title,
                          creatorId: vid.creatorId,
                          creatorName: vid.creatorName,
                          periodLabel: 'Admin Audit Cycle',
                          validImpressions: adValidImpr,
                          invalidImpressionsBlocked: adInvalidImpr,
                          grossAdRevenueInr: adGrossInr,
                          status: 'pending',
                          notes: 'Recorded by delegated Admin for CEO settlement',
                        });
                        setAdVideoId('');
                        setAdGrossInr(0);
                        await refreshMonetizationGovernance();
                      },
                      'Pending ad revenue audit cycle logged.'
                    );
                  }}
                  className="p-5 rounded-xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 space-y-3"
                >
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Submit Pending Ad Revenue Audit</h3>
                  <select
                    required
                    value={adVideoId}
                    onChange={(e) => setAdVideoId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-xs text-zinc-900 dark:text-white"
                  >
                    <option value="">Select eligible video...</option>
                    {allVideos
                      .filter((v) => v.status !== 'removed')
                      .map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.title} · {v.creatorName}
                        </option>
                      ))}
                  </select>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <input
                      type="number"
                      min={0}
                      value={adValidImpr}
                      onChange={(e) => setAdValidImpr(Number(e.target.value))}
                      placeholder="Valid Impr."
                      className="px-3 py-2 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white font-mono"
                    />
                    <input
                      type="number"
                      min={0}
                      value={adInvalidImpr}
                      onChange={(e) => setAdInvalidImpr(Number(e.target.value))}
                      placeholder="IVT Blocked"
                      className="px-3 py-2 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white font-mono"
                    />
                    <input
                      type="number"
                      min={0}
                      value={adGrossInr}
                      onChange={(e) => setAdGrossInr(Number(e.target.value))}
                      placeholder="Gross INR"
                      className="px-3 py-2 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white font-mono"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={busyKey === 'gov-ad-rec' || !adVideoId}
                    className="w-full py-2 rounded-xl bg-[#E11D48] text-xs font-semibold text-white disabled:opacity-50"
                  >
                    Log Pending Ad Cycle (Awaits CEO Settlement)
                  </button>
                </form>

                {/* Invalid Traffic Flagging */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const cr = managedUsers.find((u) => u.uid === ivtCreatorId);
                    if (!cr || !ivtTargetId.trim()) return;
                    runAdminMutation(
                      'gov-ivt-flag',
                      async (t) => {
                        await govResolveInvalidTraffic(t, {
                          action: 'flag',
                          targetType: 'video',
                          targetId: ivtTargetId.trim(),
                          creatorId: cr.uid,
                          creatorName: cr.displayName,
                          signalType: ivtSignal,
                          suspiciousCount: ivtCount,
                          estimatedImpactInr: 0,
                          severity: 'medium',
                          notes: 'Flagged by Admin for IVT audit',
                        });
                        setIvtTargetId('');
                        await refreshMonetizationGovernance();
                      },
                      'Suspicious traffic flag recorded.'
                    );
                  }}
                  className="p-5 rounded-xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 space-y-3"
                >
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-[#E11D48]" />
                    <span>Flag Invalid Traffic</span>
                  </h3>
                  <select
                    required
                    value={ivtCreatorId}
                    onChange={(e) => setIvtCreatorId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-xs text-zinc-900 dark:text-white"
                  >
                    <option value="">Select creator...</option>
                    {managedUsers
                      .filter((u) => u.isCreator)
                      .map((u) => (
                        <option key={u.uid} value={u.uid}>
                          {u.displayName} (@{u.handle})
                        </option>
                      ))}
                  </select>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <input
                      type="text"
                      required
                      value={ivtTargetId}
                      onChange={(e) => setIvtTargetId(e.target.value)}
                      placeholder="Video or Affiliate ID"
                      className="px-3 py-2 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white"
                    />
                    <input
                      type="number"
                      min={1}
                      value={ivtCount}
                      onChange={(e) => setIvtCount(Number(e.target.value))}
                      placeholder="Suspicious hits"
                      className="px-3 py-2 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white font-mono"
                    />
                  </div>
                  <input
                    type="text"
                    value={ivtSignal}
                    onChange={(e) => setIvtSignal(e.target.value)}
                    placeholder="Signal description"
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-xs text-zinc-900 dark:text-white"
                  />
                  <button
                    type="submit"
                    disabled={busyKey === 'gov-ivt-flag'}
                    className="w-full py-2 rounded-xl bg-[#F97316] text-xs font-semibold text-white disabled:opacity-50"
                  >
                    Flag Invalid Traffic
                  </button>
                </form>
              </div>

              {/* Payment Disputes & IVT Queues */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-xl bg-white dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                  <div className="px-4 py-3 bg-zinc-50 dark:bg-[#141418] border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-2">
                    <Scale className="w-4 h-4 text-[#E11D48]" />
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                      Payment Disputes ({monGov?.paymentDisputes.length ?? 0})
                    </h3>
                  </div>
                  <div className="divide-y divide-zinc-200 dark:divide-zinc-800 max-h-72 overflow-y-auto">
                    {(monGov?.paymentDisputes || []).length === 0 ? (
                      <div className="p-6 text-center text-xs text-zinc-500 dark:text-zinc-400">No disputes queued.</div>
                    ) : (
                      monGov!.paymentDisputes.map((d) => (
                        <div key={d.id} className="p-3.5 text-xs space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-zinc-900 dark:text-white">
                              {d.reporterName} · {formatInr(d.amountInr)}
                            </span>
                            <span className="uppercase text-[10px] font-semibold px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                              {d.status}
                            </span>
                          </div>
                          <p className="text-zinc-600 dark:text-zinc-400">{d.reason}</p>
                          {(d.status === 'open' || d.status === 'investigating') && (
                            <div className="flex gap-1.5">
                              {d.status === 'open' && (
                                <button
                                  type="button"
                                  disabled={busyKey === `disp-${d.id}`}
                                  onClick={() =>
                                    runAdminMutation(
                                      `disp-${d.id}`,
                                      async (t) => {
                                        await govResolveDispute(t, {
                                          disputeId: d.id,
                                          status: 'investigating',
                                          resolutionNote: 'Under Admin investigation',
                                        });
                                        await refreshMonetizationGovernance();
                                      },
                                      'Dispute marked investigating.'
                                    )
                                  }
                                  className="px-2.5 py-1 rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-amber-700 dark:text-amber-300 font-semibold"
                                >
                                  Investigate
                                </button>
                              )}
                              <button
                                type="button"
                                disabled={busyKey === `disp-${d.id}`}
                                onClick={() =>
                                  runAdminMutation(
                                    `disp-${d.id}`,
                                    async (t) => {
                                      await govResolveDispute(t, {
                                        disputeId: d.id,
                                        status: 'resolved',
                                        resolutionNote: 'Resolved by Admin audit',
                                      });
                                      await refreshMonetizationGovernance();
                                    },
                                    'Dispute resolved.'
                                  )
                                }
                                className="px-2.5 py-1 rounded bg-emerald-600 text-white font-semibold"
                              >
                                Resolve
                              </button>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Brand Connect Governance */}
                <div className="rounded-xl bg-white dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                  <div className="px-4 py-3 bg-zinc-50 dark:bg-[#141418] border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-[#EA580C] dark:text-[#F97316]" />
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                      Brand Connect Operations ({monGov?.brandApplications.length ?? 0} Apps)
                    </h3>
                  </div>
                  <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-[#141418]/60 space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <input
                        type="text"
                        value={bcBrand}
                        onChange={(e) => setBcBrand(e.target.value)}
                        placeholder="Brand Name"
                        className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white"
                      />
                      <input
                        type="number"
                        min={500}
                        value={bcBudget}
                        onChange={(e) => setBcBudget(Number(e.target.value))}
                        placeholder="Budget INR"
                        className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white font-mono"
                      />
                    </div>
                    <input
                      type="text"
                      value={bcTitle}
                      onChange={(e) => setBcTitle(e.target.value)}
                      placeholder="Campaign Title"
                      className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-xs text-zinc-900 dark:text-white"
                    />
                    <button
                      type="button"
                      disabled={!bcBrand.trim() || !bcTitle.trim() || busyKey === 'admin-bc'}
                      onClick={() =>
                        runAdminMutation(
                          'admin-bc',
                          async (t) => {
                            await govBrandConnectAction(t, {
                              action: 'create_campaign',
                              brandName: bcBrand.trim(),
                              title: bcTitle.trim(),
                              budgetInr: bcBudget,
                              deliverables: bcDeliverables,
                              deadline: bcDeadline,
                              description: 'Brand Connect sponsorship opportunity',
                            });
                            setBcBrand('');
                            setBcTitle('');
                            await refreshMonetizationGovernance();
                          },
                          'Brand campaign published.'
                        )
                      }
                      className="w-full py-1.5 rounded-lg bg-[#E11D48] text-xs font-semibold text-white disabled:opacity-40"
                    >
                      Publish Brand Campaign
                    </button>
                  </div>
                  <div className="divide-y divide-zinc-200 dark:divide-zinc-800 max-h-52 overflow-y-auto">
                    {(monGov?.brandApplications || []).map((app) => (
                      <div key={app.id} className="p-3.5 text-xs flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-bold text-zinc-900 dark:text-white truncate">
                            {app.creatorName} → {app.campaignTitle}
                          </div>
                          <div className="text-zinc-500 dark:text-zinc-400 font-mono">
                            {formatInr(app.proposedFeeInr)} · {app.status}
                          </div>
                        </div>
                        {(app.status === 'applied' || app.status === 'shortlisted') && (
                          <button
                            type="button"
                            disabled={busyKey === `bapp-${app.id}`}
                            onClick={() =>
                              runAdminMutation(
                                `bapp-${app.id}`,
                                async (t) => {
                                  await govBrandConnectAction(t, {
                                    action: 'review_application',
                                    applicationId: app.id,
                                    appStatus: app.status === 'applied' ? 'shortlisted' : 'approved',
                                    reviewNotes: 'Reviewed by Brand Connect Admin',
                                  });
                                  await refreshMonetizationGovernance();
                                },
                                'Application status updated.'
                              )
                            }
                            className="px-2.5 py-1 rounded bg-zinc-100 dark:bg-[#18181D] hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 font-semibold shrink-0"
                          >
                            {app.status === 'applied' ? 'Shortlist' : 'Approve'}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
