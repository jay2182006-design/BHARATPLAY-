import React, { useEffect, useState } from 'react';
import {
  Megaphone,
  Rocket,
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
  adminCreateAnnouncement,
  adminCreateChallenge,
  adminCreateCompetition,
  adminResolveReport,
  adminSavePlatformConfig,
  adminToggleAnnouncement,
  adminUpdateCompetition,
  adminUpdateCreatorFlags,
  adminUpdateVideoStatus,
  subscribeAllUsersAdmin,
  subscribeAllVideosAdmin,
  subscribeAnnouncements,
  subscribeReportsAdmin,
} from '../lib/bharatplayService';
import { formatCount, formatInr } from '../lib/formatters';
import type {
  AppRoute,
  CreatorChallenge,
  LeagueCompetition,
  ModerationReport,
  PlatformAnnouncement,
  PlatformConfig,
  UserPublicProfile,
  VideoItem,
} from '../types/bharatplay';

interface AdminDashboardPageProps {
  creators: UserPublicProfile[];
  challenges: CreatorChallenge[];
  competitions: LeagueCompetition[];
  platformConfig: PlatformConfig;
  onNavigate: (route: AppRoute) => void;
}

export function AdminDashboardPage({
  creators,
  challenges,
  competitions,
  platformConfig,
  onNavigate,
}: AdminDashboardPageProps) {
  const { isAdmin, profile } = useAuth();
  const { showToast } = useToast();

  const [tab, setTab] = useState<
    'creators' | 'videos' | 'competitions' | 'announcements' | 'reports' | 'categories' | 'settings'
  >('creators');
  const [allUsers, setAllUsers] = useState<UserPublicProfile[]>([]);
  const [allVideos, setAllVideos] = useState<VideoItem[]>([]);
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [allAnnouncements, setAllAnnouncements] = useState<PlatformAnnouncement[]>([]);
  const [newCategory, setNewCategory] = useState('');
  const [revShare, setRevShare] = useState(platformConfig.creatorRevenueSharePercent || 75);
  const [earlyBoost, setEarlyBoost] = useState(platformConfig.earlyCreatorBoostEnabled);
  const [maintenanceMode, setMaintenanceMode] = useState(Boolean(platformConfig.maintenanceMode));

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
    setRevShare(platformConfig.creatorRevenueSharePercent || 75);
    setEarlyBoost(platformConfig.earlyCreatorBoostEnabled);
    setMaintenanceMode(Boolean(platformConfig.maintenanceMode));
  }, [platformConfig]);

  if (!isAdmin) {
    return (
      <div className="max-w-lg mx-auto my-16 p-8 rounded-2xl bg-rose-50 border border-rose-200 text-center space-y-4">
        <ShieldAlert className="w-10 h-10 text-[#E11D48] mx-auto" />
        <h1 className="text-xl font-bold text-zinc-900 font-display">Admin Access Restricted</h1>
        <p className="text-sm text-zinc-600">
          This area requires verified BharatPlay Administrator privileges enforced by Firestore Security Rules.
        </p>
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className="px-5 py-2.5 rounded-xl bg-white hover:bg-zinc-100 border border-zinc-300 text-sm font-semibold text-zinc-900"
        >
          Return Home
        </button>
      </div>
    );
  }

  const managedUsers = allUsers.length > 0 ? allUsers : creators;
  const totalPlatformViews = allVideos.reduce((sum, v) => sum + (v.viewsCount || 0), 0);
  const totalCreators = managedUsers.filter((c) => c.isCreator).length;

  return (
    <div className="max-w-[1440px] mx-auto px-4 md:px-6 lg:px-8 py-6 space-y-8">
      <div className="flex items-center justify-between border-b border-zinc-200 pb-5">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-6 h-6 text-[#E11D48]" />
          <div>
            <h1 className="text-2xl font-bold font-display text-zinc-900">BHARATPLAY Admin Control</h1>
            <p className="text-xs text-zinc-600">
              Manage Creator Boost, Monthly League Competitions, Moderation Reports, Categories & Announcements
            </p>
          </div>
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
          <div key={k.label} className="p-5 rounded-xl bg-zinc-50 border border-zinc-200">
            <div className="text-xs text-zinc-600">{k.label}</div>
            <div className="text-2xl font-bold font-mono tabular-nums text-zinc-900 mt-1">{k.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {[
          { id: 'creators', label: 'Creator Boost & Badges' },
          { id: 'videos', label: `Content & Originals (${allVideos.length})` },
          { id: 'competitions', label: `Monthly Competitions (${competitions.length})` },
          { id: 'announcements', label: `Announcements (${allAnnouncements.length})` },
          { id: 'reports', label: `Reports (${reports.filter((r) => r.status === 'pending').length})` },
          { id: 'categories', label: 'Categories & Challenges' },
          { id: 'settings', label: 'Platform Settings' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id as any)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap ${
              tab === t.id ? 'bg-[#E11D48] text-white' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 border border-zinc-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'creators' && (
        <div className="rounded-xl bg-white border border-zinc-200 shadow-sm overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 text-zinc-600 border-b border-zinc-200">
              <tr>
                <th className="p-4">Name</th>
                <th className="p-4">League Track</th>
                <th className="p-4 text-right">Subs</th>
                <th className="p-4">Tier</th>
                <th className="p-4 text-right">Creator Controls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {managedUsers.map((c) => (
                <tr key={c.uid} className="hover:bg-zinc-50">
                  <td className="p-4 font-semibold text-zinc-900">
                    <div>{c.displayName}</div>
                    <div className="text-[11px] text-zinc-500 font-normal">@{c.handle}</div>
                  </td>
                  <td className="p-4">
                    <select
                      value={c.leagueCategory || 'Entertainment'}
                      onChange={async (e) => {
                        await adminUpdateCreatorFlags(c.uid, { leagueCategory: e.target.value });
                        showToast('League category updated.', 'success');
                      }}
                      className="px-2 py-1 rounded bg-white border border-zinc-300 text-zinc-900"
                    >
                      {['Education', 'Entertainment', 'Rising Star'].map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-4 text-right font-mono tabular-nums text-zinc-700">
                    {formatCount(c.subscribersCount)}
                  </td>
                  <td className="p-4">
                    <select
                      value={c.rewardTier || 'Seed'}
                      onChange={async (e) => {
                        await adminUpdateCreatorFlags(c.uid, { rewardTier: e.target.value as any });
                        showToast('Creator tier updated.', 'success');
                      }}
                      className="px-2 py-1 rounded bg-white border border-zinc-300 text-zinc-900"
                    >
                      {['Seed', 'Rising', 'Star', 'Icon'].map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-4 text-right space-x-2 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={async () => {
                        await adminUpdateCreatorFlags(c.uid, { boostEnabled: !c.boostEnabled });
                        showToast(c.boostEnabled ? 'Creator Boost disabled' : 'Creator Boost enabled', 'success');
                      }}
                      className={`px-2.5 py-1 rounded-lg ${
                        c.boostEnabled ? 'bg-[#E11D48] text-white' : 'bg-white border border-zinc-300 text-zinc-700 hover:bg-zinc-100'
                      }`}
                    >
                      <Rocket className="w-3 h-3 inline mr-1" />
                      {c.boostEnabled ? 'Boosted' : 'Boost'}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await adminUpdateCreatorFlags(c.uid, { isFeatured: !c.isFeatured });
                        showToast(c.isFeatured ? 'Removed from Featured' : 'Added to Featured Creators', 'success');
                      }}
                      className={`px-2.5 py-1 rounded-lg ${
                        c.isFeatured ? 'bg-[#F97316] text-white' : 'bg-white border border-zinc-300 text-zinc-700 hover:bg-zinc-100'
                      }`}
                    >
                      <Star className="w-3 h-3 inline mr-1" />
                      {c.isFeatured ? 'Featured' : 'Feature'}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await adminUpdateCreatorFlags(c.uid, { isVerified: !c.isVerified });
                        showToast('Verification updated.', 'success');
                      }}
                      className={`px-2.5 py-1 rounded-lg ${
                        c.isVerified ? 'bg-emerald-600 text-white' : 'bg-white border border-zinc-300 text-zinc-700 hover:bg-zinc-100'
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
            <div key={v.id} className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-zinc-900 truncate">{v.title}</div>
                <div className="text-xs text-zinc-600 tabular-nums">
                  {v.creatorName} · {v.status} · {formatCount(v.viewsCount)} views · {v.language}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => adminUpdateVideoStatus(v.id, v.status, v.isTrending, !v.isOriginal)}
                  className={`px-3 py-1.5 rounded-lg text-xs inline-flex items-center gap-1 ${
                    v.isOriginal ? 'bg-gradient-to-r from-[#E11D48] to-[#F97316] text-white' : 'bg-white border border-zinc-300 text-zinc-700 hover:bg-zinc-100'
                  }`}
                >
                  <Sparkles className="w-3 h-3" />
                  {v.isOriginal ? 'Original' : 'Mark Original'}
                </button>
                <button
                  type="button"
                  onClick={() => adminUpdateVideoStatus(v.id, v.status, !v.isTrending, v.isOriginal)}
                  className={`px-3 py-1.5 rounded-lg text-xs ${
                    v.isTrending ? 'bg-[#F97316] text-white' : 'bg-white border border-zinc-300 text-zinc-700 hover:bg-zinc-100'
                  }`}
                >
                  {v.isTrending ? 'Trending' : 'Mark Trending'}
                </button>
                <button
                  type="button"
                  onClick={() => adminUpdateVideoStatus(v.id, v.status === 'published' ? 'flagged' : 'published')}
                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-zinc-100 border border-zinc-300 text-xs text-zinc-800"
                >
                  {v.status === 'published' ? 'Flag' : 'Restore'}
                </button>
                <button
                  type="button"
                  onClick={() => adminUpdateVideoStatus(v.id, 'removed')}
                  className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-[#BE123C] text-xs font-medium"
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
            onSubmit={async (e) => {
              e.preventDefault();
              await adminCreateCompetition({
                title: compTitle,
                monthLabel: compMonth,
                description: compDesc,
                prizePoolInr: compPrize,
              });
              setCompTitle('');
              setCompDesc('');
              showToast('Monthly Creator League competition created!', 'success');
            }}
            className="lg:col-span-5 p-6 rounded-xl bg-zinc-50 border border-zinc-200 space-y-4 h-fit"
          >
            <h2 className="text-base font-bold text-zinc-900 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-[#EA580C]" />
              <span>Launch Monthly Competition</span>
            </h2>
            <input
              type="text"
              required
              value={compTitle}
              onChange={(e) => setCompTitle(e.target.value)}
              placeholder="Competition title (e.g., Creator League Season 5)"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-zinc-300 text-xs text-zinc-900 placeholder-zinc-400"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                required
                value={compMonth}
                onChange={(e) => setCompMonth(e.target.value)}
                placeholder="Month (e.g., December 2026)"
                className="px-3.5 py-2.5 rounded-xl bg-white border border-zinc-300 text-xs text-zinc-900 placeholder-zinc-400"
              />
              <input
                type="number"
                required
                value={compPrize}
                onChange={(e) => setCompPrize(Number(e.target.value))}
                placeholder="Prize Pool INR"
                className="px-3.5 py-2.5 rounded-xl bg-white border border-zinc-300 text-xs text-zinc-900 placeholder-zinc-400"
              />
            </div>
            <textarea
              rows={3}
              required
              value={compDesc}
              onChange={(e) => setCompDesc(e.target.value)}
              placeholder="Rules and judging criteria..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-zinc-300 text-xs text-zinc-900 placeholder-zinc-400"
            />
            <button type="submit" className="w-full py-2.5 rounded-xl bg-[#E11D48] hover:bg-[#BE123C] text-xs font-semibold text-white">
              Create League Season
            </button>
          </form>

          <div className="lg:col-span-7 space-y-3">
            {competitions.map((comp) => (
              <div key={comp.id} className="p-5 rounded-xl bg-zinc-50 border border-zinc-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-bold text-zinc-900">{comp.title}</div>
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${
                      comp.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-200 text-zinc-700'
                    }`}
                  >
                    {comp.status}
                  </span>
                </div>
                <div className="text-xs text-[#EA580C] font-mono font-semibold">
                  {comp.monthLabel} · {formatInr(comp.prizePoolInr)} Prize Pool
                </div>
                <p className="text-xs text-zinc-600">{comp.description}</p>
                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      adminUpdateCompetition(comp.id, {
                        status: comp.status === 'active' ? 'completed' : 'active',
                      })
                    }
                    className="px-3 py-1.5 rounded-lg bg-white hover:bg-zinc-100 border border-zinc-300 text-xs font-medium text-zinc-900"
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
            onSubmit={async (e) => {
              e.preventDefault();
              await adminCreateAnnouncement({
                title: annTitle,
                body: annBody,
                category: annCat,
                createdBy: profile?.displayName || 'BHARATPLAY Admin',
              });
              setAnnTitle('');
              setAnnBody('');
              showToast('Platform announcement published!', 'success');
            }}
            className="lg:col-span-5 p-6 rounded-xl bg-zinc-50 border border-zinc-200 space-y-4 h-fit"
          >
            <h2 className="text-base font-bold text-zinc-900 flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-[#EA580C]" />
              <span>Broadcast Platform Announcement</span>
            </h2>
            <input
              type="text"
              required
              value={annTitle}
              onChange={(e) => setAnnTitle(e.target.value)}
              placeholder="Announcement headline"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-zinc-300 text-xs text-zinc-900 placeholder-zinc-400"
            />
            <select
              value={annCat}
              onChange={(e) => setAnnCat(e.target.value as any)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-zinc-300 text-xs text-zinc-900"
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
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-zinc-300 text-xs text-zinc-900 placeholder-zinc-400"
            />
            <button type="submit" className="w-full py-2.5 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-xs font-semibold text-white">
              Publish Announcement
            </button>
          </form>

          <div className="lg:col-span-7 space-y-3">
            {allAnnouncements.map((a) => (
              <div key={a.id} className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] uppercase font-bold text-[#EA580C]">{a.category}</span>
                    <span className="text-[11px] text-zinc-500">{a.isActive ? 'Active' : 'Archived'}</span>
                  </div>
                  <div className="text-sm font-bold text-zinc-900">{a.title}</div>
                  <p className="text-xs text-zinc-600">{a.body}</p>
                </div>
                <button
                  type="button"
                  onClick={() => adminToggleAnnouncement(a.id, !a.isActive)}
                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-zinc-100 border border-zinc-300 text-xs font-medium text-zinc-900 shrink-0"
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
            <div className="p-8 rounded-xl bg-zinc-50 border border-zinc-200 text-center text-sm text-zinc-600">
              No moderation reports submitted.
            </div>
          ) : (
            reports.map((r) => (
              <div key={r.id} className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-zinc-900">
                    [{r.targetType}] {r.targetTitle || r.targetId}
                  </div>
                  <p className="text-xs text-zinc-600 mt-0.5">Reason: {r.reason} · Status: {r.status}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => adminResolveReport(r.id, 'resolved')}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold text-white"
                  >
                    Resolve
                  </button>
                  <button
                    type="button"
                    onClick={() => adminResolveReport(r.id, 'dismissed')}
                    className="px-3 py-1.5 rounded-lg bg-white hover:bg-zinc-100 border border-zinc-300 text-xs text-zinc-700"
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
          <div className="p-6 rounded-xl bg-zinc-50 border border-zinc-200 space-y-4">
            <h2 className="text-base font-bold text-zinc-900">Manage Categories</h2>
            <div className="flex flex-wrap gap-2">
              {platformConfig.categories.map((cat) => (
                <div key={cat} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-zinc-200 text-xs text-zinc-900">
                  <span>{cat}</span>
                  <button
                    type="button"
                    onClick={async () => {
                      const next = platformConfig.categories.filter((c) => c !== cat);
                      await adminSavePlatformConfig({ ...platformConfig, categories: next });
                      showToast('Category removed.', 'info');
                    }}
                    className="text-zinc-500 hover:text-[#E11D48]"
                    aria-label={`Remove ${cat}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!newCategory.trim()) return;
                const next = Array.from(new Set([...platformConfig.categories, newCategory.trim()]));
                await adminSavePlatformConfig({ ...platformConfig, categories: next });
                setNewCategory('');
                showToast('Category added.', 'success');
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="New category..."
                className="flex-1 px-3 py-2 rounded-xl bg-white border border-zinc-300 text-xs text-zinc-900 placeholder-zinc-400"
              />
              <button type="submit" className="px-4 py-2 rounded-xl bg-[#E11D48] hover:bg-[#BE123C] text-xs font-semibold text-white">
                Add
              </button>
            </form>
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await adminCreateChallenge({
                title: chgTitle,
                description: chgDesc,
                prizePoolInr: chgPrize,
                category: chgCat,
                deadline: chgDeadline,
              });
              setChgTitle('');
              setChgDesc('');
              showToast('New weekly Creator Challenge launched!', 'success');
            }}
            className="p-6 rounded-xl bg-zinc-50 border border-zinc-200 space-y-4"
          >
            <h2 className="text-base font-bold text-zinc-900">Launch Creator Challenge ({challenges.length} active)</h2>
            <input
              type="text"
              required
              value={chgTitle}
              onChange={(e) => setChgTitle(e.target.value)}
              placeholder="Challenge Title"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-zinc-300 text-sm text-zinc-900 placeholder-zinc-400"
            />
            <textarea
              rows={2}
              required
              value={chgDesc}
              onChange={(e) => setChgDesc(e.target.value)}
              placeholder="Challenge brief & criteria"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-zinc-300 text-sm text-zinc-900 placeholder-zinc-400"
            />
            <div className="grid grid-cols-3 gap-2">
              <input
                type="number"
                value={chgPrize}
                onChange={(e) => setChgPrize(Number(e.target.value))}
                placeholder="Prize INR"
                className="px-3 py-2 rounded-xl bg-white border border-zinc-300 text-xs text-zinc-900"
              />
              <input
                type="text"
                value={chgCat}
                onChange={(e) => setChgCat(e.target.value)}
                placeholder="Category"
                className="px-3 py-2 rounded-xl bg-white border border-zinc-300 text-xs text-zinc-900"
              />
              <input
                type="date"
                value={chgDeadline}
                onChange={(e) => setChgDeadline(e.target.value)}
                className="px-3 py-2 rounded-xl bg-white border border-zinc-300 text-xs text-zinc-900"
              />
            </div>
            <button type="submit" className="w-full py-2.5 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-xs font-semibold text-white">
              Launch Challenge
            </button>
          </form>
        </div>
      )}

      {tab === 'settings' && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await adminSavePlatformConfig({
              ...platformConfig,
              creatorRevenueSharePercent: revShare,
              earlyCreatorBoostEnabled: earlyBoost,
              maintenanceMode,
            });
            showToast('Platform settings saved.', 'success');
          }}
          className="max-w-xl p-6 rounded-xl bg-zinc-50 border border-zinc-200 space-y-4"
        >
          <h2 className="text-base font-bold text-zinc-900">Platform Configuration</h2>
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1.5">
              Creator Ad-Revenue Share (%)
            </label>
            <input
              type="number"
              min={10}
              max={95}
              value={revShare}
              onChange={(e) => setRevShare(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-zinc-300 text-sm text-zinc-900 font-mono"
            />
          </div>
          <label className="flex items-center gap-2.5 text-xs text-zinc-700 cursor-pointer">
            <input type="checkbox" checked={earlyBoost} onChange={(e) => setEarlyBoost(e.target.checked)} className="accent-[#F97316]" />
            <span>Enable Early Creator Discovery Boost</span>
          </label>
          <label className="flex items-center gap-2.5 text-xs text-zinc-700 cursor-pointer">
            <input type="checkbox" checked={maintenanceMode} onChange={(e) => setMaintenanceMode(e.target.checked)} className="accent-[#E11D48]" />
            <span>Maintenance Mode</span>
          </label>
          <button type="submit" className="px-5 py-2.5 rounded-xl bg-[#E11D48] hover:bg-[#BE123C] text-xs font-semibold text-white">
            Save Platform Config
          </button>
        </form>
      )}
    </div>
  );
}
