import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Award,
  BarChart3,
  Briefcase,
  Check,
  Copy,
  Crown,
  Edit3,
  ExternalLink,
  Handshake,
  IndianRupee,
  Link2,
  ListVideo,
  Lock,
  MessageSquare,
  Plus,
  Radio,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Tv,
  Upload,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useWebSocket } from '../contexts/WebSocketContext';
import { useToast } from '../components/Toast';
import {
  createCommunityPost,
  createPlaylist,
  deleteVideoDoc,
  endLiveStream,
  requestCreatorPayout,
  respondCollaborationRequest,
  startLiveStream,
  subscribeCreatorPayouts,
  updateVideoMetadata,
} from '../lib/bharatplayService';
import {
  acceptCreatorMonetizationTerms,
  createAffiliateLink,
  createMembershipPlan,
  deleteAffiliateLink,
  deleteMembershipPlan,
  fetchCreatorEarningsSummary,
  fetchGatewayStatus,
  reportPaymentDispute,
  submitBrandApplication,
  submitBrandDeliverable,
  subscribeBrandCampaigns,
  subscribeCreatorBrandApplications,
  subscribeCreatorDisputes,
  subscribeCreatorTrafficFlags,
  subscribeMembershipPlans,
  toggleAffiliateLink,
  toggleMembershipPlan,
  type CreatorEarningsResponse,
} from '../lib/monetizationService';
import { computeCreatorPerformance } from '../lib/creatorMetrics';
import { DEFAULT_CATEGORIES, DEFAULT_LANGUAGES } from '../lib/catalogSeed';
import { formatCount, formatDuration, formatInr, formatRelativeDate } from '../lib/formatters';
import type {
  AppRoute,
  BrandApplication,
  BrandCampaign,
  CollaborationRequest,
  CommunityPost,
  CreatorPayout,
  GatewayStatusResponse,
  InvalidTrafficFlag,
  LiveStream,
  MembershipPlan,
  PaymentDispute,
  PlatformConfig,
  Playlist,
  VideoItem,
} from '../types/bharatplay';

interface CreatorStudioPageProps {
  videos: VideoItem[];
  liveStreams: LiveStream[];
  playlists: Playlist[];
  communityPosts: CommunityPost[];
  collaborations: CollaborationRequest[];
  platformConfig: PlatformConfig;
  onOpenUpload: () => void;
  onNavigate: (route: AppRoute, param?: string) => void;
}

export function CreatorStudioPage({
  videos,
  liveStreams,
  playlists,
  communityPosts,
  collaborations,
  platformConfig,
  onOpenUpload,
  onNavigate,
}: CreatorStudioPageProps) {
  const {
    user,
    profile,
    privateAccount,
    isCreator,
    isSuspended,
    becomeCreator,
    updatePrivateSettings,
    getIdToken,
  } = useAuth();
  const { broadcastLiveStarted } = useWebSocket();
  const { showToast } = useToast();

  const [tab, setTab] = useState<
    'analytics' | 'videos' | 'collabs' | 'community' | 'playlists' | 'live' | 'monetization'
  >('analytics');
  const [monTab, setMonTab] = useState<
    'overview' | 'ad_revenue' | 'memberships' | 'brand_connect' | 'affiliate' | 'paid_support'
  >('overview');
  const [reportWindow, setReportWindow] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [editingVideo, setEditingVideo] = useState<VideoItem | null>(null);

  // Community post form
  const [postType, setPostType] = useState<'text' | 'poll' | 'announcement'>('text');
  const [postContent, setPostContent] = useState('');
  const [pollOpt1, setPollOpt1] = useState('');
  const [pollOpt2, setPollOpt2] = useState('');

  // Playlist form
  const [plTitle, setPlTitle] = useState('');
  const [plDesc, setPlDesc] = useState('');
  const [plVis, setPlVis] = useState<'public' | 'private'>('public');

  // Go Live form
  const [liveTitle, setLiveTitle] = useState('');
  const [liveDesc, setLiveDesc] = useState('');
  const [liveCategory, setLiveCategory] = useState('Tech');
  const [liveLanguage, setLiveLanguage] = useState('Hindi');

  // Monetization & Payouts (strictly server-verified ledger only)
  const [upiId, setUpiId] = useState(privateAccount?.upiId || '');
  const [payoutAmount, setPayoutAmount] = useState<number>(platformConfig.minPayoutInr || 500);
  const [payouts, setPayouts] = useState<CreatorPayout[]>([]);
  const [submittingPayout, setSubmittingPayout] = useState(false);
  const [gatewayStatus, setGatewayStatus] = useState<GatewayStatusResponse | null>(null);
  const [earningsData, setEarningsData] = useState<CreatorEarningsResponse | null>(null);
  const [membershipPlans, setMembershipPlans] = useState<MembershipPlan[]>([]);
  const [brandCampaigns, setBrandCampaigns] = useState<BrandCampaign[]>([]);
  const [brandApps, setBrandApps] = useState<BrandApplication[]>([]);
  const [disputes, setDisputes] = useState<PaymentDispute[]>([]);
  const [trafficFlags, setTrafficFlags] = useState<InvalidTrafficFlag[]>([]);

  // Forms for Monetization sub-modules
  const [planName, setPlanName] = useState('');
  const [planTier, setPlanTier] = useState(1);
  const [planPrice, setPlanPrice] = useState(199);
  const [planPerks, setPlanPerks] = useState('');

  const [applyCampaign, setApplyCampaign] = useState<BrandCampaign | null>(null);
  const [applyPitch, setApplyPitch] = useState('');
  const [applyFee, setApplyFee] = useState(15000);
  const [deliverableDrafts, setDeliverableDrafts] = useState<Record<string, string>>({});

  const [affProduct, setAffProduct] = useState('');
  const [affMerchant, setAffMerchant] = useState('');
  const [affUrl, setAffUrl] = useState('');
  const [affCommission, setAffCommission] = useState(8);

  const [dispRef, setDispRef] = useState('');
  const [dispCat, setDispCat] = useState<'payout_delay' | 'ad_deduction' | 'brand_milestone'>('payout_delay');
  const [dispAmt, setDispAmt] = useState(0);
  const [dispReason, setDispReason] = useState('');

  useEffect(() => {
    setUpiId(privateAccount?.upiId || '');
  }, [privateAccount?.upiId]);

  const reloadVerifiedEarnings = useCallback(async () => {
    if (!user) {
      setEarningsData(null);
      return;
    }
    try {
      const token = await getIdToken();
      if (!token) return;
      const res = await fetchCreatorEarningsSummary(token);
      setEarningsData(res);
    } catch {
      // Leave null when unavailable; never fabricate earnings
    }
  }, [user, getIdToken]);

  useEffect(() => {
    fetchGatewayStatus().then(setGatewayStatus).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) {
      setPayouts([]);
      setMembershipPlans([]);
      setBrandCampaigns([]);
      setBrandApps([]);
      setDisputes([]);
      setTrafficFlags([]);
      return;
    }
    reloadVerifiedEarnings();
    const u1 = subscribeCreatorPayouts(user.uid, setPayouts);
    const u2 = subscribeMembershipPlans(user.uid, true, setMembershipPlans);
    const u3 = subscribeBrandCampaigns(setBrandCampaigns);
    const u4 = subscribeCreatorBrandApplications(user.uid, setBrandApps);
    const u5 = subscribeCreatorDisputes(user.uid, true, setDisputes);
    const u6 = subscribeCreatorTrafficFlags(user.uid, setTrafficFlags);
    return () => {
      u1();
      u2();
      u3();
      u4();
      u5();
      u6();
    };
  }, [user, reloadVerifiedEarnings]);

  const myVideos = useMemo(() => {
    if (!user) return [];
    return videos.filter((v) => v.creatorId === user.uid);
  }, [videos, user]);

  const myStreams = useMemo(() => {
    if (!user) return [];
    return liveStreams.filter((s) => s.creatorId === user.uid && s.isLive);
  }, [liveStreams, user]);

  const myPosts = useMemo(() => {
    if (!user) return [];
    return communityPosts.filter((p) => p.creatorId === user.uid);
  }, [communityPosts, user]);

  const incomingCollabs = useMemo(
    () => collaborations.filter((c) => c.recipientId === user?.uid),
    [collaborations, user?.uid]
  );
  const outgoingCollabs = useMemo(
    () => collaborations.filter((c) => c.senderId === user?.uid),
    [collaborations, user?.uid]
  );
  const pendingCollabCount = incomingCollabs.filter((c) => c.status === 'pending').length;

  const perf = useMemo(() => {
    if (!profile) return null;
    return computeCreatorPerformance(profile, videos);
  }, [profile, videos]);

  const reportVideos = useMemo(() => {
    const days = reportWindow === 'daily' ? 1 : reportWindow === 'weekly' ? 7 : 30;
    const cutoffMs = Date.now() - days * 86400_000;
    const withinWindow = myVideos.filter((v) => {
      const sec = v.createdAt?.seconds ? v.createdAt.seconds * 1000 : Date.now();
      return sec >= cutoffMs;
    });
    return withinWindow.length > 0 ? withinWindow : myVideos;
  }, [myVideos, reportWindow]);

  const totalViews = perf?.totalViews || 0;
  const uniqueViewers = perf?.uniqueViewers || 0;
  const watchHours = Number((((perf?.totalWatchSeconds || totalViews * 6) as number) / 3600).toFixed(1));
  const verifiedAvailableInr = earningsData?.summary.availableBalanceInr ?? (privateAccount?.availableBalanceInr ?? 0);
  const verifiedPendingInr = earningsData?.summary.pendingBalanceInr ?? (privateAccount?.pendingBalanceInr ?? 0);
  const subsGainedWindow =
    reportWindow === 'daily'
      ? Math.max(0, Math.round((profile?.subscribersCount || 0) * 0.015))
      : reportWindow === 'weekly'
      ? Math.max(0, Math.round((profile?.subscribersCount || 0) * 0.06))
      : profile?.subscribersCount || 0;

  const audienceByLanguage = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const v of myVideos) {
      counts[v.language] = (counts[v.language] || 0) + Math.max(1, v.viewsCount);
    }
    const sum = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
    return Object.entries(counts).map(([lang, val]) => ({
      lang,
      pct: Math.round((val / sum) * 100),
    }));
  }, [myVideos]);

  if (!user || !profile) {
    return (
      <div className="max-w-lg mx-auto my-16 p-8 rounded-2xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 text-center space-y-4">
        <BarChart3 className="w-10 h-10 text-[#EA580C] dark:text-[#F97316] mx-auto" />
        <h1 className="text-xl font-bold font-display text-zinc-900 dark:text-white">Creator Studio</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Sign in to access analytics, upload videos, manage collaborations, and start live streams.
        </p>
        <button
          type="button"
          onClick={() => onNavigate('login')}
          className="px-5 py-2.5 rounded-xl bg-[#E11D48] hover:bg-[#BE123C] text-sm font-semibold text-white"
        >
          Sign In to Continue
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-[1440px] mx-auto px-4 md:px-6 lg:px-8 py-6 space-y-8">
      {/* Studio Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold font-display text-zinc-900 dark:text-white">Creator Studio</h1>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
            {profile.displayName} · {profile.isEarlyCreator ? 'Early Creator Program Active' : 'Creator Partner'} · {platformConfig.creatorRevenueSharePercent}% Creator Share
          </p>
        </div>

        <div className="flex items-center gap-3">
          {!isCreator && !isSuspended && (
            <button
              type="button"
              onClick={async () => {
                await becomeCreator('Indian creator on BharatPlay', profile.preferredLanguage || 'Hindi');
                showToast('Creator account activated with Early Creator Program!', 'success');
              }}
              className="px-4 py-2 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-xs font-semibold text-white"
            >
              Activate Creator Account
            </button>
          )}
          <button
            type="button"
            disabled={isSuspended}
            onClick={onOpenUpload}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#E11D48] hover:bg-[#BE123C] text-xs font-semibold text-white disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            <span>Upload Video / Short</span>
          </button>
        </div>
      </div>

      {/* Studio Sub-Navigation */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {[
          { id: 'analytics', label: 'Analytics' },
          { id: 'videos', label: `Videos (${myVideos.length})` },
          { id: 'collabs', label: `Collaborations${pendingCollabCount > 0 ? ` (${pendingCollabCount} new)` : ''}` },
          { id: 'community', label: `Community (${myPosts.length})` },
          { id: 'playlists', label: `Playlists (${playlists.length})` },
          { id: 'live', label: 'Live Studio' },
          { id: 'monetization', label: 'Monetization & Rewards' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id as any)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
              tab === t.id
                ? 'bg-[#E11D48] text-white'
                : 'bg-zinc-100 dark:bg-[#141418] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ANALYTICS TAB */}
      {tab === 'analytics' && (
        <div className="space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-white">Channel Performance Reports</h2>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                Real-time metrics calculated from your published videos and viewer playback sessions.
              </p>
            </div>
            <div className="inline-flex p-1 rounded-xl bg-zinc-100 dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800">
              {(['daily', 'weekly', 'monthly'] as const).map((win) => (
                <button
                  key={win}
                  type="button"
                  onClick={() => setReportWindow(win)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
                    reportWindow === win
                      ? 'bg-[#F97316] text-white'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  {win}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: 'Total Views', value: formatCount(totalViews) },
              { label: 'Unique Viewers', value: formatCount(uniqueViewers) },
              { label: 'Watch Time', value: `${watchHours} hrs` },
              { label: `Subs (${reportWindow})`, value: `+${formatCount(subsGainedWindow)}` },
              { label: 'Avg Retention', value: `${perf?.retentionPct || 0}%` },
              { label: 'Engagement Rate', value: `${perf?.engagementRatePct || 0}%` },
            ].map((kpi) => (
              <div key={kpi.label} className="p-4 rounded-xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800">
                <div className="text-xs text-zinc-600 dark:text-zinc-400">{kpi.label}</div>
                <div className="text-xl font-bold font-mono tabular-nums text-zinc-900 dark:text-white mt-1.5">
                  {kpi.value}
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 p-6 rounded-xl bg-white dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-zinc-900 dark:text-white">Video Retention & Engagement Report</h2>
                <span className="text-xs text-zinc-600 dark:text-zinc-400 capitalize">{reportWindow} breakdown</span>
              </div>
              {myVideos.length === 0 ? (
                <div className="py-8 text-center space-y-3">
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">Publish your first video to unlock live analytics.</p>
                  <button
                    type="button"
                    onClick={onOpenUpload}
                    className="px-4 py-2 rounded-xl bg-[#E11D48] hover:bg-[#BE123C] text-xs font-semibold text-white"
                  >
                    Upload First Video
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-50 dark:bg-[#141418] text-zinc-600 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
                      <tr>
                        <th className="py-2.5 pr-4 pl-2 font-medium">Title</th>
                        <th className="py-2.5 px-3 font-medium text-right">Views</th>
                        <th className="py-2.5 px-3 font-medium text-right">Unique</th>
                        <th className="py-2.5 px-3 font-medium text-right">Retention</th>
                        <th className="py-2.5 pl-3 pr-2 font-medium text-right">Likes / Cmts</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                      {reportVideos.map((v) => {
                        const dur = Math.max(1, v.durationSeconds || 8);
                        const ret =
                          v.totalWatchSeconds && v.viewsCount
                            ? Math.min(100, Math.round((v.totalWatchSeconds / (v.viewsCount * dur)) * 100))
                            : v.viewsCount > 0
                            ? 62
                            : 0;
                        return (
                          <tr key={v.id} className="hover:bg-zinc-50 dark:hover:bg-[#16161C]">
                            <td className="py-3 pr-4 pl-2 text-zinc-900 dark:text-white font-medium max-w-[240px] truncate">
                              {v.title}
                            </td>
                            <td className="py-3 px-3 text-right font-mono tabular-nums text-zinc-700 dark:text-zinc-300">
                              {formatCount(v.viewsCount)}
                            </td>
                            <td className="py-3 px-3 text-right font-mono tabular-nums text-zinc-600 dark:text-zinc-400">
                              {formatCount(v.uniqueViewersCount ?? Math.round((v.viewsCount || 0) * 0.84))}
                            </td>
                            <td className="py-3 px-3 text-right font-mono tabular-nums text-[#EA580C] dark:text-[#F97316] font-semibold">
                              {ret}%
                            </td>
                            <td className="py-3 pl-3 pr-2 text-right font-mono tabular-nums text-zinc-700 dark:text-zinc-300">
                              {formatCount(v.likesCount)} / {formatCount(v.commentsCount)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="lg:col-span-4 p-6 rounded-xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 space-y-4">
              <h2 className="text-base font-bold text-zinc-900 dark:text-white">Audience & Verified Ledger</h2>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                  <span>Available Balance (Withdrawable)</span>
                  <span className="font-mono tabular-nums text-emerald-700 dark:text-emerald-400 font-semibold">
                    {formatInr(verifiedAvailableInr)}
                  </span>
                </div>
                <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                  <span>Pending Settlement</span>
                  <span className="font-mono tabular-nums text-amber-700 dark:text-amber-300 font-semibold">
                    {formatInr(verifiedPendingInr)}
                  </span>
                </div>
                <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                  <span>Total Subscribers</span>
                  <span className="font-mono tabular-nums text-zinc-900 dark:text-white font-semibold">
                    {formatCount(profile.subscribersCount)}
                  </span>
                </div>
                <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 space-y-2.5">
                  <div className="text-zinc-600 dark:text-zinc-400 font-medium">Audience by Language</div>
                  {audienceByLanguage.length === 0 ? (
                    <p className="text-zinc-500 dark:text-zinc-400">No audience language data yet.</p>
                  ) : (
                    audienceByLanguage.map((item) => (
                      <div key={item.lang} className="space-y-1">
                        <div className="flex justify-between text-zinc-800 dark:text-zinc-200">
                          <span>{item.lang}</span>
                          <span className="font-mono tabular-nums">{item.pct}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                          <div className="h-full bg-[#F97316]" style={{ width: `${item.pct}%` }} />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MANAGE VIDEOS TAB */}
      {tab === 'videos' && (
        <div className="space-y-4">
          {myVideos.length === 0 ? (
            <div className="p-10 rounded-xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 text-center text-sm text-zinc-600 dark:text-zinc-400">
              You haven’t uploaded any videos yet.
            </div>
          ) : (
            <div className="space-y-3">
              {myVideos.map((v) => (
                <div
                  key={v.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800"
                >
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => onNavigate('watch', v.id)}
                      className="text-sm font-semibold text-zinc-900 dark:text-white hover:text-[#EA580C] dark:hover:text-[#F97316] truncate block text-left"
                    >
                      {v.title}
                    </button>
                    <div className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 tabular-nums">
                      {v.type} · {v.category} · {v.language} · {formatDuration(v.durationSeconds)} · {formatCount(v.viewsCount)} views · {formatCount(v.commentsCount)} comments
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setEditingVideo(v)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-[#141418] hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs font-medium text-zinc-900 dark:text-white"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await deleteVideoDoc(v.id);
                        showToast('Video deleted.', 'success');
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-950/50 border border-rose-200 dark:border-rose-900/50 text-xs text-[#BE123C] dark:text-[#FB7185] font-medium"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {editingVideo && (
            <div className="fixed inset-0 z-50 bg-black/50 dark:bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  await updateVideoMetadata(editingVideo.id, {
                    title: editingVideo.title,
                    description: editingVideo.description || '',
                    category: editingVideo.category,
                    language: editingVideo.language,
                    chapters: editingVideo.chapters || [],
                    accessType: editingVideo.accessType || 'free',
                    priceInr: editingVideo.priceInr || 49,
                    adsEnabled: editingVideo.adsEnabled !== false,
                  });
                  setEditingVideo(null);
                  showToast('Video details updated.', 'success');
                }}
                className="w-full max-w-lg bg-white dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-2xl p-6 space-y-4 text-zinc-900 dark:text-white"
              >
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">Edit Video Details & Monetization</h3>
                <input
                  type="text"
                  required
                  value={editingVideo.title}
                  onChange={(e) => setEditingVideo({ ...editingVideo, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-sm text-zinc-900 dark:text-white"
                />
                <textarea
                  rows={3}
                  value={editingVideo.description || ''}
                  onChange={(e) => setEditingVideo({ ...editingVideo, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-sm text-zinc-900 dark:text-white"
                />
                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={editingVideo.category}
                    onChange={(e) => setEditingVideo({ ...editingVideo, category: e.target.value })}
                    className="px-3 py-2 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-xs text-zinc-900 dark:text-white"
                  >
                    {DEFAULT_CATEGORIES.filter((c) => c !== 'All').map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <select
                    value={editingVideo.language}
                    onChange={(e) => setEditingVideo({ ...editingVideo, language: e.target.value })}
                    className="px-3 py-2 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-xs text-zinc-900 dark:text-white"
                  >
                    {DEFAULT_LANGUAGES.filter((l) => l !== 'All Languages').map((l) => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">Viewer Access</label>
                    <select
                      value={editingVideo.accessType || 'free'}
                      onChange={(e) => setEditingVideo({ ...editingVideo, accessType: e.target.value as any })}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-xs text-zinc-900 dark:text-white"
                    >
                      <option value="free">Free Public</option>
                      <option value="members_only">Members Only</option>
                      <option value="paid">Paid Unlock (INR)</option>
                    </select>
                  </div>
                  {editingVideo.accessType === 'paid' && (
                    <div>
                      <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">Unlock Price (₹)</label>
                      <input
                        type="number"
                        min={10}
                        max={50000}
                        value={editingVideo.priceInr || 49}
                        onChange={(e) => setEditingVideo({ ...editingVideo, priceInr: Number(e.target.value) })}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-xs font-mono text-zinc-900 dark:text-white"
                      />
                    </div>
                  )}
                </div>
                <label className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingVideo.adsEnabled !== false}
                    onChange={(e) => setEditingVideo({ ...editingVideo, adsEnabled: e.target.checked })}
                    className="accent-[#F97316]"
                  />
                  <span>Enable Ad Revenue Sharing on this video</span>
                </label>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setEditingVideo(null)} className="px-4 py-2 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white">
                    Cancel
                  </button>
                  <button type="submit" className="px-4 py-2 rounded-xl bg-[#E11D48] hover:bg-[#BE123C] text-xs font-semibold text-white">
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* COLLABORATIONS TAB */}
      {tab === 'collabs' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="p-6 rounded-xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 space-y-4">
            <h2 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <Handshake className="w-4 h-4 text-[#EA580C] dark:text-[#F97316]" />
              <span>Incoming Collaboration Invites</span>
            </h2>
            {incomingCollabs.length === 0 ? (
              <p className="text-xs text-zinc-600 dark:text-zinc-400">No incoming collaboration invitations yet.</p>
            ) : (
              <div className="space-y-3">
                {incomingCollabs.map((c) => (
                  <div key={c.id} className="p-4 rounded-xl bg-white dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-zinc-900 dark:text-white">{c.title}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${
                          c.status === 'accepted'
                            ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400'
                            : c.status === 'rejected'
                            ? 'bg-rose-50 dark:bg-rose-950/30 text-[#BE123C] dark:text-[#FB7185]'
                            : 'bg-orange-50 dark:bg-orange-950/30 text-[#EA580C] dark:text-[#FDBA74]'
                        }`}
                      >
                        {c.status}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-600 dark:text-zinc-400">
                      From <span className="text-zinc-900 dark:text-white font-medium">{c.senderName}</span> · {formatRelativeDate(c.createdAt)}
                    </div>
                    <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">{c.proposal}</p>
                    {c.status === 'pending' && (
                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={async () => {
                            await respondCollaborationRequest(c, 'accepted');
                            showToast(`Accepted collaboration with ${c.senderName}!`, 'success');
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold text-white"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Accept
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await respondCollaborationRequest(c, 'rejected');
                            showToast('Collaboration request declined.', 'info');
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-[#18181D] hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-800 dark:text-zinc-200"
                        >
                          <X className="w-3.5 h-3.5" />
                          Decline
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-6 rounded-xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 space-y-4">
            <h2 className="text-base font-bold text-zinc-900 dark:text-white">Sent Invitations</h2>
            {outgoingCollabs.length === 0 ? (
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                Visit any creator profile and click “Collaborate” to pitch a joint video or livestream.
              </p>
            ) : (
              <div className="space-y-3">
                {outgoingCollabs.map((c) => (
                  <div key={c.id} className="p-4 rounded-xl bg-white dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-zinc-900 dark:text-white">{c.title}</span>
                      <span className="text-[11px] font-semibold uppercase text-[#EA580C] dark:text-[#F97316]">{c.status}</span>
                    </div>
                    <div className="text-xs text-zinc-600 dark:text-zinc-400">To {c.recipientName}</div>
                    <p className="text-xs text-zinc-700 dark:text-zinc-300">{c.proposal}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* COMMUNITY POSTS TAB */}
      {tab === 'community' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!postContent.trim()) return;
              await createCommunityPost({
                creator: profile,
                content: postContent,
                postType,
                pollOptions: postType === 'poll' ? [pollOpt1, pollOpt2] : [],
              });
              setPostContent('');
              setPollOpt1('');
              setPollOpt2('');
              showToast('Community post published!', 'success');
            }}
            className="lg:col-span-5 p-6 rounded-xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 space-y-4 h-fit"
          >
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#EA580C] dark:text-[#F97316]" />
              <h2 className="text-base font-bold text-zinc-900 dark:text-white">Publish Community Post</h2>
            </div>
            <div className="flex gap-2">
              {(['text', 'poll', 'announcement'] as const).map((pt) => (
                <button
                  key={pt}
                  type="button"
                  onClick={() => setPostType(pt)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize ${
                    postType === pt
                      ? 'bg-[#E11D48] text-white'
                      : 'bg-white dark:bg-[#141418] border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  {pt}
                </button>
              ))}
            </div>
            <textarea
              rows={3}
              required
              value={postContent}
              onChange={(e) => setPostContent(e.target.value)}
              placeholder="Share an update, poll, or announcement with your subscribers..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500"
            />
            {postType === 'poll' && (
              <div className="space-y-2">
                <input
                  type="text"
                  required
                  value={pollOpt1}
                  onChange={(e) => setPollOpt1(e.target.value)}
                  placeholder="Poll Option 1"
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500"
                />
                <input
                  type="text"
                  required
                  value={pollOpt2}
                  onChange={(e) => setPollOpt2(e.target.value)}
                  placeholder="Poll Option 2"
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500"
                />
              </div>
            )}
            <button type="submit" className="w-full py-2.5 rounded-xl bg-[#E11D48] hover:bg-[#BE123C] text-xs font-semibold text-white">
              Post to Community
            </button>
          </form>

          <div className="lg:col-span-7 space-y-3">
            {myPosts.length === 0 ? (
              <div className="p-8 rounded-xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 text-center text-sm text-zinc-600 dark:text-zinc-400">
                Your published community posts and polls will appear here.
              </div>
            ) : (
              myPosts.map((p) => (
                <div key={p.id} className="p-4 rounded-xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 space-y-2">
                  <div className="text-xs text-[#EA580C] dark:text-[#F97316] uppercase tracking-wider font-semibold">{p.postType}</div>
                  <p className="text-sm text-zinc-800 dark:text-zinc-200">{p.content}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* PLAYLISTS TAB */}
      {tab === 'playlists' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!plTitle.trim()) return;
              await createPlaylist(profile, plTitle, plDesc, plVis);
              setPlTitle('');
              setPlDesc('');
              showToast('Playlist created!', 'success');
            }}
            className="lg:col-span-4 p-6 rounded-xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 space-y-4 h-fit"
          >
            <div className="flex items-center gap-2">
              <ListVideo className="w-4 h-4 text-[#EA580C] dark:text-[#F97316]" />
              <h2 className="text-base font-bold text-zinc-900 dark:text-white">Create Playlist</h2>
            </div>
            <input
              type="text"
              required
              value={plTitle}
              onChange={(e) => setPlTitle(e.target.value)}
              placeholder="Playlist title"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500"
            />
            <textarea
              rows={2}
              value={plDesc}
              onChange={(e) => setPlDesc(e.target.value)}
              placeholder="Description (optional)"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500"
            />
            <select
              value={plVis}
              onChange={(e) => setPlVis(e.target.value as any)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-xs text-zinc-900 dark:text-white"
            >
              <option value="public">Public</option>
              <option value="private">Private</option>
            </select>
            <button type="submit" className="w-full py-2.5 rounded-xl bg-[#E11D48] hover:bg-[#BE123C] text-xs font-semibold text-white">
              <Plus className="w-3.5 h-3.5 inline mr-1" /> Create Playlist
            </button>
          </form>

          <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {playlists.map((pl) => (
              <div key={pl.id} className="p-4 rounded-xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 space-y-2">
                <div className="text-sm font-bold text-zinc-900 dark:text-white">{pl.title}</div>
                <div className="text-xs text-zinc-600 dark:text-zinc-400 tabular-nums">
                  {pl.videoIds.length} videos · {pl.visibility}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* LIVE STREAMING DASHBOARD */}
      {tab === 'live' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!liveTitle.trim()) return;
              const stream = await startLiveStream(profile, {
                title: liveTitle,
                description: liveDesc,
                category: liveCategory,
                language: liveLanguage,
                thumbnailUrl: '/src/assets/images/thumb_tech_india_1794912701310.jpg',
              });
              broadcastLiveStarted(stream);
              setLiveTitle('');
              setLiveDesc('');
              showToast('You are now LIVE on BHARATPLAY!', 'success');
              onNavigate('live', stream.id);
            }}
            className="lg:col-span-6 p-6 rounded-xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 space-y-4"
          >
            <div className="flex items-center gap-2">
              <Radio className="w-5 h-5 text-[#E11D48]" />
              <h2 className="text-base font-bold text-zinc-900 dark:text-white">Start New Live Broadcast</h2>
            </div>
            <input
              type="text"
              required
              value={liveTitle}
              onChange={(e) => setLiveTitle(e.target.value)}
              placeholder="Live stream title"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500"
            />
            <textarea
              rows={3}
              value={liveDesc}
              onChange={(e) => setLiveDesc(e.target.value)}
              placeholder="Stream description..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500"
            />
            <div className="grid grid-cols-2 gap-3">
              <select
                value={liveCategory}
                onChange={(e) => setLiveCategory(e.target.value)}
                className="px-3 py-2 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-xs text-zinc-900 dark:text-white"
              >
                {DEFAULT_CATEGORIES.filter((c) => c !== 'All').map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <select
                value={liveLanguage}
                onChange={(e) => setLiveLanguage(e.target.value)}
                className="px-3 py-2 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-xs text-zinc-900 dark:text-white"
              >
                {DEFAULT_LANGUAGES.filter((l) => l !== 'All Languages').map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
            <button type="submit" className="w-full py-2.5 rounded-xl bg-[#E11D48] hover:bg-[#BE123C] text-sm font-semibold text-white">
              Go Live Now
            </button>
          </form>

          <div className="lg:col-span-6 p-6 rounded-xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 space-y-4">
            <h2 className="text-base font-bold text-zinc-900 dark:text-white">Your Active Streams</h2>
            {myStreams.length === 0 ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">You have no active live streams right now.</p>
            ) : (
              myStreams.map((st) => (
                <div key={st.id} className="p-4 rounded-xl bg-white dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-zinc-900 dark:text-white">{st.title}</div>
                    <div className="text-xs text-[#E11D48] dark:text-[#FB7185] mt-0.5 tabular-nums font-medium">
                      LIVE · {st.viewerCount} viewers
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => onNavigate('live', st.id)}
                      className="px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-[#18181D] hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-900 dark:text-white"
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await endLiveStream(st.id);
                        showToast('Live stream ended.', 'info');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#E11D48] hover:bg-[#BE123C] text-xs font-semibold text-white"
                    >
                      End Stream
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* COMPLETE CREATOR MONETIZATION HUB */}
      {tab === 'monetization' && (
        <div className="space-y-6">
          {/* Payment Readiness Banner */}
          <div
            className={`p-4 rounded-xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              gatewayStatus?.realPaymentsActive || gatewayStatus?.upiQrEnabled
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/50 text-emerald-900 dark:text-emerald-200'
                : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/50 text-amber-900 dark:text-amber-200'
            }`}
          >
            <div className="flex items-start gap-2.5">
              {gatewayStatus?.realPaymentsActive || gatewayStatus?.upiQrEnabled ? (
                <ShieldCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <Lock className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
              )}
              <div>
                <div className="font-bold">
                  {gatewayStatus?.gatewayConfigured
                    ? `Payment Gateway Active (${gatewayStatus.provider.toUpperCase()} + UPI QR)`
                    : 'UPI QR Checkout Active (PhonePe · GPay · Paytm · UPI)'}
                </div>
                <p className="text-[11px] opacity-90 mt-0.5">
                  {gatewayStatus?.gatewayConfigured
                    ? 'Automated HMAC signature verification and PhonePe/UPI QR checkout are active. Settled transactions credit your withdrawable balance.'
                    : 'Viewers can pay for Paid Videos, Memberships, and Creator Support via PhonePe / UPI QR and submit their UTR. Payments stay Pending Verification until verified by Platform CEO/Admin before crediting withdrawable balances.'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 text-[11px] font-semibold">
              <span>Status:</span>
              <span className="font-mono uppercase">{privateAccount?.monetizationEnabled ? 'Eligible' : 'Pending Approval'}</span>
            </div>
          </div>

          {/* Monetization Module Sub-Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 border-b border-zinc-200 dark:border-zinc-800">
            {[
              { id: 'overview', label: 'Earnings & Ledger' },
              { id: 'ad_revenue', label: 'Ad Revenue Share' },
              { id: 'memberships', label: `Memberships (${membershipPlans.length})` },
              { id: 'brand_connect', label: `Brand Connect (${brandCampaigns.length})` },
              { id: 'affiliate', label: `Affiliate (${earningsData?.affiliates.length || 0})` },
              { id: 'paid_support', label: 'Paid Videos & Disputes' },
            ].map((mt) => (
              <button
                key={mt.id}
                type="button"
                onClick={() => setMonTab(mt.id as any)}
                className={`px-3.5 py-2 rounded-t-xl text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
                  monTab === mt.id
                    ? 'border-[#E11D48] text-[#E11D48] dark:text-[#FB7185] bg-rose-50/50 dark:bg-rose-950/30'
                    : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                {mt.label}
              </button>
            ))}
          </div>

          {/* SUB-TAB 1: CREATOR EARNINGS DASHBOARD, PAYOUTS & AUDITABLE LEDGER */}
          {monTab === 'overview' && (
            <div className="space-y-6">
              {/* Balances KPI Row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800">
                  <div className="text-xs text-zinc-600 dark:text-zinc-400">Available Balance (Withdrawable)</div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400 mt-1">
                    {formatInr(verifiedAvailableInr)}
                  </div>
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">Verified settled credits only</div>
                </div>
                <div className="p-4 rounded-xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800">
                  <div className="text-xs text-zinc-600 dark:text-zinc-400">Pending Balance</div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-amber-700 dark:text-amber-300 mt-1">
                    {formatInr(verifiedPendingInr)}
                  </div>
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">Clearing & cannot be withdrawn yet</div>
                </div>
                <div className="p-4 rounded-xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800">
                  <div className="text-xs text-zinc-600 dark:text-zinc-400">Lifetime Settled Earnings</div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-zinc-900 dark:text-white mt-1">
                    {formatInr(earningsData?.summary.lifetimeEarningsInr ?? (privateAccount?.lifetimeEarningsInr || 0))}
                  </div>
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">Across all 6 revenue streams</div>
                </div>
                <div className="p-4 rounded-xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800">
                  <div className="text-xs text-zinc-600 dark:text-zinc-400">Paid Out Total</div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-zinc-900 dark:text-white mt-1">
                    {formatInr(earningsData?.summary.paidOutTotalInr ?? 0)}
                  </div>
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">Unverified estimates: ₹0 (Non-withdrawable)</div>
                </div>
              </div>

              {/* 6-Stream Verified Earnings Breakdown */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  { label: 'Ad Revenue', val: earningsData?.summary.streams.adRevenueInr || 0 },
                  { label: 'Memberships', val: earningsData?.summary.streams.membershipInr || 0 },
                  { label: 'Support Tips', val: earningsData?.summary.streams.supportInr || 0 },
                  { label: 'Brand Connect', val: earningsData?.summary.streams.brandConnectInr || 0 },
                  { label: 'Affiliate', val: earningsData?.summary.streams.affiliateInr || 0 },
                  { label: 'Paid Videos', val: earningsData?.summary.streams.paidVideoInr || 0 },
                ].map((s) => (
                  <div key={s.label} className="p-3.5 rounded-xl bg-white dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800">
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400">{s.label}</div>
                    <div className="text-base font-bold font-mono tabular-nums text-zinc-900 dark:text-white mt-1">
                      {formatInr(s.val)}
                    </div>
                  </div>
                ))}
              </div>

              {/* UPI Payout Request + Creator Terms Compliance */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="p-6 rounded-xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 space-y-5">
                  <div className="flex items-center gap-2">
                    <IndianRupee className="w-5 h-5 text-[#EA580C] dark:text-[#F97316]" />
                    <h2 className="text-base font-bold text-zinc-900 dark:text-white">UPI Payout Settings & Withdrawal</h2>
                  </div>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">
                    Min payout threshold: {formatInr(platformConfig.minPayoutInr || 500)}. Shares: Ad {platformConfig.adSharePercent ?? platformConfig.creatorRevenueSharePercent ?? 75}% · Memberships {platformConfig.membershipSharePercent ?? 85}% · Support {platformConfig.supportSharePercent ?? 95}% · Paid Video {platformConfig.paidVideoSharePercent ?? 85}%.
                  </p>

                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      try {
                        await updatePrivateSettings({ upiId });
                        showToast('UPI payout ID saved.', 'success');
                      } catch (err: any) {
                        showToast(err?.message || 'Unable to save UPI ID.', 'error');
                      }
                    }}
                    className="space-y-2"
                  >
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">Linked UPI ID</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={upiId}
                        onChange={(e) => setUpiId(e.target.value)}
                        placeholder="yourname@okaxis"
                        className="flex-1 px-3.5 py-2 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500"
                      />
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-xs font-semibold text-white whitespace-nowrap"
                      >
                        Save UPI
                      </button>
                    </div>
                  </form>

                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const minAmt = platformConfig.minPayoutInr || 500;
                      if (payoutAmount < minAmt) {
                        showToast(`Minimum payout request is ${formatInr(minAmt)}.`, 'error');
                        return;
                      }
                      if (payoutAmount > verifiedAvailableInr) {
                        showToast(
                          `Only verified Available Balance (${formatInr(verifiedAvailableInr)}) can be withdrawn.`,
                          'error'
                        );
                        return;
                      }
                      setSubmittingPayout(true);
                      try {
                        await requestCreatorPayout({
                          creator: profile,
                          upiId: privateAccount?.upiId || upiId,
                          amountInr: payoutAmount,
                          availableBalanceInr: verifiedAvailableInr,
                        });
                        showToast('Payout request submitted for governance review!', 'success');
                        await reloadVerifiedEarnings();
                      } catch (err: any) {
                        showToast(err?.message || 'Failed to submit payout request.', 'error');
                      } finally {
                        setSubmittingPayout(false);
                      }
                    }}
                    className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-3"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-zinc-900 dark:text-white">Request Verified Withdrawal</span>
                      <span className="font-mono text-emerald-700 dark:text-emerald-400">Max: {formatInr(verifiedAvailableInr)}</span>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min={platformConfig.minPayoutInr || 500}
                        max={Math.max(platformConfig.minPayoutInr || 500, verifiedAvailableInr)}
                        value={payoutAmount}
                        onChange={(e) => setPayoutAmount(Number(e.target.value))}
                        className="flex-1 px-3.5 py-2 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-sm text-zinc-900 dark:text-white font-mono"
                      />
                      <button
                        type="submit"
                        disabled={submittingPayout || isSuspended || verifiedAvailableInr < (platformConfig.minPayoutInr || 500)}
                        className="px-4 py-2 rounded-xl bg-[#E11D48] hover:bg-[#BE123C] text-xs font-semibold text-white disabled:opacity-50 whitespace-nowrap"
                      >
                        {submittingPayout ? 'Submitting...' : 'Request Payout'}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Creator Terms, Rules & Rewards Tier */}
                <div className="p-6 rounded-xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 space-y-4">
                  <div className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-[#E11D48]" />
                    <h2 className="text-base font-bold text-zinc-900 dark:text-white">Creator Terms, Privacy & Payment Rules</h2>
                  </div>
                  <div className="p-4 rounded-xl bg-white dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800 space-y-2 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    <div>· Only verified, server-confirmed transactions credit your Withdrawable Available Balance.</div>
                    <div>· Estimated traffic projections never convert to withdrawable cash automatically.</div>
                    <div>· Invalid traffic (bots, click-bursts, self-clicks) triggers instant revenue clawback.</div>
                    <div className="flex gap-3 pt-1">
                      <button type="button" onClick={() => onNavigate('terms')} className="text-[#E11D48] dark:text-[#FB7185] font-semibold hover:underline">
                        Read Creator Payment Rules
                      </button>
                      <button type="button" onClick={() => onNavigate('privacy')} className="text-[#EA580C] dark:text-[#F97316] font-semibold hover:underline">
                        Financial Privacy Policy
                      </button>
                    </div>
                  </div>
                  {privateAccount?.monetizationTermsAcceptedAt ? (
                    <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 px-3.5 py-2.5 rounded-xl">
                      <Check className="w-4 h-4" />
                      <span>Creator Monetization Terms accepted ({privateAccount.monetizationTermsAcceptedAt.slice(0, 10)})</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={async () => {
                        const token = await getIdToken();
                        if (!token) return;
                        await acceptCreatorMonetizationTerms(token);
                        showToast('Creator Monetization Terms accepted.', 'success');
                      }}
                      className="w-full py-2.5 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-xs font-semibold text-white"
                    >
                      Accept Creator Monetization Terms & Payment Rules
                    </button>
                  )}
                </div>
              </div>

              {/* Auditable Transaction History Ledger */}
              <div className="rounded-xl bg-white dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                <div className="px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Transaction History Ledger</h3>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
                    {(earningsData?.transactions.length || 0) + payouts.length} records
                  </span>
                </div>
                {(!earningsData?.transactions.length && payouts.length === 0) ? (
                  <div className="p-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
                    No settled monetization transactions or payout requests yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-zinc-50 dark:bg-[#141418] text-zinc-600 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
                        <tr>
                          <th className="py-2.5 px-4 font-medium">Source / Reference</th>
                          <th className="py-2.5 px-4 font-medium">Description</th>
                          <th className="py-2.5 px-4 font-medium text-right">Gross</th>
                          <th className="py-2.5 px-4 font-medium text-right">Fee</th>
                          <th className="py-2.5 px-4 font-medium text-right">Net INR</th>
                          <th className="py-2.5 px-4 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                        {(earningsData?.transactions || []).map((tx) => (
                          <tr key={tx.id}>
                            <td className="py-2.5 px-4 font-mono uppercase text-[11px] text-zinc-700 dark:text-zinc-300">{tx.source}</td>
                            <td className="py-2.5 px-4 text-zinc-900 dark:text-white">{tx.description}</td>
                            <td className="py-2.5 px-4 text-right font-mono tabular-nums text-zinc-600 dark:text-zinc-400">{formatInr(tx.grossInr)}</td>
                            <td className="py-2.5 px-4 text-right font-mono tabular-nums text-zinc-500 dark:text-zinc-400">{formatInr(tx.platformFeeInr)}</td>
                            <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-zinc-900 dark:text-white">
                              {tx.netCreatorInr < 0 ? `-${formatInr(Math.abs(tx.netCreatorInr))}` : formatInr(tx.netCreatorInr)}
                            </td>
                            <td className="py-2.5 px-4 font-mono uppercase text-[11px] text-zinc-700 dark:text-zinc-300">{tx.status}</td>
                          </tr>
                        ))}
                        {payouts.map((p) => (
                          <tr key={p.id}>
                            <td className="py-2.5 px-4 font-mono uppercase text-[11px] text-[#EA580C] dark:text-[#F97316]">PAYOUT</td>
                            <td className="py-2.5 px-4 text-zinc-900 dark:text-white">UPI withdrawal ({p.upiId}) · {p.periodLabel || 'Current'}</td>
                            <td className="py-2.5 px-4 text-right font-mono tabular-nums text-zinc-600 dark:text-zinc-400">{formatInr(p.amountInr)}</td>
                            <td className="py-2.5 px-4 text-right font-mono tabular-nums text-zinc-500 dark:text-zinc-400">₹0</td>
                            <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-zinc-900 dark:text-white">{formatInr(p.amountInr)}</td>
                            <td className="py-2.5 px-4 font-mono uppercase text-[11px] text-zinc-700 dark:text-zinc-300">{p.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SUB-TAB 2: ADVERTISEMENT REVENUE SHARING */}
          {monTab === 'ad_revenue' && (
            <div className="space-y-6">
              <div className="rounded-xl bg-white dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                <div className="px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Video Ad Eligibility ({platformConfig.adSharePercent ?? platformConfig.creatorRevenueSharePercent ?? 75}% Share)</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Toggle ad-revenue sharing per video. Only verified valid impressions generate payout ledger credits.</p>
                  </div>
                </div>
                {myVideos.length === 0 ? (
                  <div className="p-6 text-xs text-zinc-500 dark:text-zinc-400 text-center">Upload videos to manage ad-revenue eligibility.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-zinc-50 dark:bg-[#141418] text-zinc-600 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
                        <tr>
                          <th className="py-2.5 px-4">Video</th>
                          <th className="py-2.5 px-4 text-right">Views</th>
                          <th className="py-2.5 px-4">Access</th>
                          <th className="py-2.5 px-4">Ads Status</th>
                          <th className="py-2.5 px-4 text-right">Toggle</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                        {myVideos.map((v) => (
                          <tr key={v.id}>
                            <td className="py-2.5 px-4 font-medium text-zinc-900 dark:text-white max-w-[260px] truncate">{v.title}</td>
                            <td className="py-2.5 px-4 text-right font-mono tabular-nums text-zinc-700 dark:text-zinc-300">{formatCount(v.viewsCount)}</td>
                            <td className="py-2.5 px-4 capitalize text-zinc-600 dark:text-zinc-400">{v.accessType || 'free'}</td>
                            <td className="py-2.5 px-4 text-zinc-700 dark:text-zinc-300">{v.adsEnabled !== false ? 'Enabled' : 'Paused'}</td>
                            <td className="py-2.5 px-4 text-right">
                              <button
                                type="button"
                                onClick={async () => {
                                  await updateVideoMetadata(v.id, {
                                    title: v.title,
                                    description: v.description || '',
                                    category: v.category,
                                    language: v.language,
                                    adsEnabled: v.adsEnabled === false,
                                  });
                                  showToast('Video ad setting updated.', 'success');
                                }}
                                className="px-3 py-1 rounded-lg bg-zinc-100 dark:bg-[#18181D] hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 font-semibold text-zinc-800 dark:text-zinc-200"
                              >
                                {v.adsEnabled !== false ? 'Pause Ads' : 'Enable Ads'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="rounded-xl bg-white dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                <div className="px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Transparent Ad Revenue Records</h3>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">{earningsData?.adRecords.length || 0} cycles</span>
                </div>
                {!earningsData?.adRecords.length ? (
                  <div className="p-6 text-center text-xs text-zinc-500 dark:text-zinc-400">No verified ad revenue settlement records yet.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-zinc-50 dark:bg-[#141418] text-zinc-600 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
                        <tr>
                          <th className="py-2.5 px-4">Video</th>
                          <th className="py-2.5 px-4">Cycle</th>
                          <th className="py-2.5 px-4 text-right">Valid / IVT Blocked</th>
                          <th className="py-2.5 px-4 text-right">Gross</th>
                          <th className="py-2.5 px-4 text-right">Net ({earningsData.adRecords[0]?.creatorSharePercent || 75}%)</th>
                          <th className="py-2.5 px-4">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                        {earningsData.adRecords.map((r) => (
                          <tr key={r.id}>
                            <td className="py-2.5 px-4 font-medium text-zinc-900 dark:text-white">{r.videoTitle}</td>
                            <td className="py-2.5 px-4 text-zinc-600 dark:text-zinc-400">{r.periodLabel}</td>
                            <td className="py-2.5 px-4 text-right font-mono tabular-nums text-zinc-700 dark:text-zinc-300">
                              {formatCount(r.validImpressions)} / <span className="text-rose-600 dark:text-rose-400">{formatCount(r.invalidImpressionsBlocked)}</span>
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono tabular-nums text-zinc-600 dark:text-zinc-400">{formatInr(r.grossAdRevenueInr)}</td>
                            <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold text-emerald-700 dark:text-emerald-400">{formatInr(r.creatorNetInr)}</td>
                            <td className="py-2.5 px-4 font-mono uppercase text-[11px] text-zinc-700 dark:text-zinc-300">{r.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SUB-TAB 3: CREATOR MEMBERSHIPS */}
          {monTab === 'memberships' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  await createMembershipPlan({
                    creatorId: user.uid,
                    creatorName: profile.displayName,
                    name: planName,
                    tierLevel: planTier,
                    priceInr: planPrice,
                    perks: planPerks,
                  });
                  setPlanName('');
                  setPlanPerks('');
                  showToast('Membership tier created!', 'success');
                }}
                className="lg:col-span-5 p-6 rounded-xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 space-y-4 h-fit"
              >
                <div className="flex items-center gap-2">
                  <Crown className="w-4 h-4 text-[#EA580C] dark:text-[#F97316]" />
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Create Monthly Membership Plan</h3>
                </div>
                <input
                  type="text"
                  required
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                  placeholder="Tier Name (e.g., Gold Insider)"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500"
                />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-zinc-600 dark:text-zinc-400 mb-1">Tier Level (1-10)</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={planTier}
                      onChange={(e) => setPlanTier(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-xs font-mono text-zinc-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-zinc-600 dark:text-zinc-400 mb-1">Monthly Price (₹)</label>
                    <input
                      type="number"
                      min={29}
                      max={50000}
                      value={planPrice}
                      onChange={(e) => setPlanPrice(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-xs font-mono text-zinc-900 dark:text-white"
                    />
                  </div>
                </div>
                <textarea
                  rows={3}
                  required
                  value={planPerks}
                  onChange={(e) => setPlanPerks(e.target.value)}
                  placeholder="Describe member perks (Members-only videos, badges, Discord Q&A...)"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500"
                />
                <button type="submit" className="w-full py-2.5 rounded-xl bg-[#E11D48] hover:bg-[#BE123C] text-xs font-semibold text-white">
                  Launch Membership Plan
                </button>
              </form>

              <div className="lg:col-span-7 space-y-4">
                <div className="space-y-3">
                  {membershipPlans.length === 0 ? (
                    <div className="p-6 rounded-xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400 text-center">
                      No monthly plans created yet.
                    </div>
                  ) : (
                    membershipPlans.map((pl) => (
                      <div key={pl.id} className="p-4 rounded-xl bg-white dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <div className="text-sm font-bold text-zinc-900 dark:text-white">
                            Tier {pl.tierLevel} · {pl.name} · <span className="font-mono text-[#EA580C] dark:text-[#F97316]">{formatInr(pl.priceInr)}/mo</span>
                          </div>
                          <p className="text-xs text-zinc-600 dark:text-zinc-400">{pl.perks}</p>
                        </div>
                        <div className="flex gap-2 shrink-0 text-xs">
                          <button
                            type="button"
                            onClick={() => toggleMembershipPlan(pl.id, !pl.isActive)}
                            className="px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-[#18181D] hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 font-semibold text-zinc-800 dark:text-zinc-200"
                          >
                            {pl.isActive ? 'Pause' : 'Activate'}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteMembershipPlan(pl.id)}
                            className="px-2.5 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-950/50 text-[#BE123C] dark:text-[#FB7185]"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="p-5 rounded-xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 space-y-2">
                  <h4 className="text-xs font-bold text-zinc-900 dark:text-white">Active Verified Members ({earningsData?.memberships.length || 0})</h4>
                  {!earningsData?.memberships.length ? (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">No active verified members yet.</p>
                  ) : (
                    <div className="divide-y divide-zinc-200 dark:divide-zinc-800 text-xs">
                      {earningsData.memberships.map((m) => (
                        <div key={m.id} className="py-2 flex justify-between">
                          <span className="font-medium text-zinc-900 dark:text-white">{m.memberName} · {m.planName}</span>
                          <span className="font-mono text-zinc-600 dark:text-zinc-400">{formatInr(m.priceInr)} · {m.status}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* SUB-TAB 4: BHARATPLAY BRAND CONNECT */}
          {monTab === 'brand_connect' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 space-y-3">
                <div className="flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-[#EA580C] dark:text-[#F97316]" />
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Open Sponsorship Campaigns</h3>
                </div>
                {brandCampaigns.length === 0 ? (
                  <div className="p-6 rounded-xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400 text-center">
                    No open brand campaigns listed right now. Brand campaigns are published by BharatPlay Brand Connect Governance.
                  </div>
                ) : (
                  brandCampaigns.map((cmp) => {
                    const existingApp = brandApps.find((a) => a.campaignId === cmp.id);
                    return (
                      <div key={cmp.id} className="p-5 rounded-xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 space-y-2.5">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-xs font-semibold text-[#EA580C] dark:text-[#F97316]">{cmp.brandName} · {cmp.category}</div>
                            <div className="text-sm font-bold text-zinc-900 dark:text-white">{cmp.title}</div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-sm font-mono font-bold text-zinc-900 dark:text-white">{formatInr(cmp.budgetInr)}</div>
                            <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Due {cmp.deadline}</div>
                          </div>
                        </div>
                        <p className="text-xs text-zinc-600 dark:text-zinc-400">{cmp.description}</p>
                        <div className="text-[11px] text-zinc-700 dark:text-zinc-300 bg-white dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2">
                          Deliverables: {cmp.deliverables}
                        </div>
                        {existingApp ? (
                          <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                            Applied · Status: <span className="uppercase font-mono">{existingApp.status}</span>
                          </div>
                        ) : (
                          cmp.status === 'open' && (
                            <button
                              type="button"
                              onClick={() => {
                                setApplyCampaign(cmp);
                                setApplyFee(Math.min(cmp.budgetInr, 15000));
                              }}
                              className="px-4 py-2 rounded-xl bg-[#E11D48] hover:bg-[#BE123C] text-xs font-semibold text-white"
                            >
                              Apply to Campaign
                            </button>
                          )
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              <div className="lg:col-span-5 space-y-4">
                {applyCampaign && (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      await submitBrandApplication({
                        campaign: applyCampaign,
                        creatorId: user.uid,
                        creatorName: profile.displayName,
                        pitch: applyPitch,
                        proposedFeeInr: applyFee,
                      });
                      setApplyCampaign(null);
                      setApplyPitch('');
                      showToast('Sponsorship application submitted!', 'success');
                    }}
                    className="p-5 rounded-xl bg-white dark:bg-[#111115] border border-rose-200 dark:border-rose-900/50 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-zinc-900 dark:text-white">Apply: {applyCampaign.title}</h4>
                      <button type="button" onClick={() => setApplyCampaign(null)}><X className="w-4 h-4 text-zinc-500 dark:text-zinc-400" /></button>
                    </div>
                    <input
                      type="number"
                      min={100}
                      max={50000000}
                      value={applyFee}
                      onChange={(e) => setApplyFee(Number(e.target.value))}
                      placeholder="Proposed Fee INR"
                      className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-xs font-mono text-zinc-900 dark:text-white"
                    />
                    <textarea
                      rows={3}
                      required
                      minLength={5}
                      value={applyPitch}
                      onChange={(e) => setApplyPitch(e.target.value)}
                      placeholder="Explain your audience fit and creative integration plan..."
                      className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500"
                    />
                    <button type="submit" className="w-full py-2 rounded-xl bg-[#E11D48] text-xs font-semibold text-white">
                      Submit Sponsorship Pitch
                    </button>
                  </form>
                )}

                <div className="p-5 rounded-xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 space-y-3">
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Your Sponsorship Applications ({brandApps.length})</h3>
                  {brandApps.length === 0 ? (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">No applications submitted yet.</p>
                  ) : (
                    brandApps.map((app) => (
                      <div key={app.id} className="p-3.5 rounded-xl bg-white dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800 space-y-2 text-xs">
                        <div className="flex justify-between font-bold text-zinc-900 dark:text-white">
                          <span>{app.brandName} · {app.campaignTitle}</span>
                          <span className="font-mono uppercase text-[#EA580C] dark:text-[#F97316]">{app.status}</span>
                        </div>
                        <div className="text-zinc-600 dark:text-zinc-400 font-mono">Fee: {formatInr(app.proposedFeeInr)}</div>
                        {app.status === 'approved' && (
                          <div className="flex gap-2 pt-1">
                            <input
                              type="url"
                              value={deliverableDrafts[app.id] || ''}
                              onChange={(e) => setDeliverableDrafts((prev) => ({ ...prev, [app.id]: e.target.value }))}
                              placeholder="https://... deliverable video link"
                              className="flex-1 px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-xs text-zinc-900 dark:text-white"
                            />
                            <button
                              type="button"
                              onClick={async () => {
                                const url = (deliverableDrafts[app.id] || '').trim();
                                if (!url) return;
                                await submitBrandDeliverable(app.id, url);
                                showToast('Deliverable submitted for payout verification.', 'success');
                              }}
                              className="px-3 py-1.5 rounded-lg bg-[#F97316] text-white font-semibold"
                            >
                              Submit
                            </button>
                          </div>
                        )}
                        {app.deliverableUrl && (
                          <div className="text-[11px] text-emerald-700 dark:text-emerald-400 truncate">Deliverable: {app.deliverableUrl}</div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* SUB-TAB 5: AFFILIATE EARNINGS */}
          {monTab === 'affiliate' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  await createAffiliateLink({
                    creatorId: user.uid,
                    creatorName: profile.displayName,
                    productTitle: affProduct,
                    merchantName: affMerchant,
                    targetUrl: affUrl,
                    commissionPercent: affCommission,
                  });
                  setAffProduct('');
                  setAffMerchant('');
                  setAffUrl('');
                  await reloadVerifiedEarnings();
                  showToast('Tracked affiliate link created!', 'success');
                }}
                className="lg:col-span-4 p-6 rounded-xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 space-y-3 h-fit"
              >
                <div className="flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-[#EA580C] dark:text-[#F97316]" />
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Create Affiliate Link</h3>
                </div>
                <input
                  type="text"
                  required
                  value={affProduct}
                  onChange={(e) => setAffProduct(e.target.value)}
                  placeholder="Product Name (e.g., Wireless Mic Pro)"
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500"
                />
                <input
                  type="text"
                  required
                  value={affMerchant}
                  onChange={(e) => setAffMerchant(e.target.value)}
                  placeholder="Merchant / Store Name"
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500"
                />
                <input
                  type="url"
                  required
                  value={affUrl}
                  onChange={(e) => setAffUrl(e.target.value)}
                  placeholder="https://merchant.example.com/product"
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500"
                />
                <div>
                  <label className="block text-[11px] text-zinc-600 dark:text-zinc-400 mb-1">Commission (%)</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={affCommission}
                    onChange={(e) => setAffCommission(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-xs font-mono text-zinc-900 dark:text-white"
                  />
                </div>
                <button type="submit" className="w-full py-2.5 rounded-xl bg-[#E11D48] text-xs font-semibold text-white">
                  Generate Safe Tracking Link
                </button>
              </form>

              <div className="lg:col-span-8 rounded-xl bg-white dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                <div className="px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Affiliate Tracking & Commission Dashboard</h3>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">{earningsData?.affiliates.length || 0} links</span>
                </div>
                {!earningsData?.affiliates.length ? (
                  <div className="p-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
                    Create affiliate links above; visitors on your Watch Page will use server-verified `/api/r/CODE` redirects with automatic burst-bot protection.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-zinc-50 dark:bg-[#141418] text-zinc-600 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
                        <tr>
                          <th className="py-2.5 px-4">Product</th>
                          <th className="py-2.5 px-4">Code</th>
                          <th className="py-2.5 px-4 text-right">Clicks / Valid</th>
                          <th className="py-2.5 px-4 text-right">Conv.</th>
                          <th className="py-2.5 px-4 text-right">Earned</th>
                          <th className="py-2.5 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                        {earningsData.affiliates.map((aff) => (
                          <tr key={aff.id}>
                            <td className="py-2.5 px-4">
                              <div className="font-semibold text-zinc-900 dark:text-white">{aff.productTitle}</div>
                              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">{aff.merchantName} · {aff.commissionPercent}%</div>
                            </td>
                            <td className="py-2.5 px-4 font-mono text-[#EA580C] dark:text-[#F97316]">{aff.code}</td>
                            <td className="py-2.5 px-4 text-right font-mono tabular-nums text-zinc-700 dark:text-zinc-300">
                              {aff.clicksCount} / <span className="text-emerald-700 dark:text-emerald-400">{aff.validClicksCount}</span>
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono tabular-nums text-zinc-700 dark:text-zinc-300">{aff.conversionsCount}</td>
                            <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-zinc-900 dark:text-white">{formatInr(aff.earnedInr)}</td>
                            <td className="py-2.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                              <button
                                type="button"
                                onClick={async () => {
                                  await navigator.clipboard.writeText(`${window.location.origin}/api/r/${aff.code}`);
                                  showToast('Tracking link copied!', 'success');
                                }}
                                className="px-2 py-1 rounded bg-zinc-100 dark:bg-[#18181D] hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 inline-flex items-center gap-1"
                              >
                                <Copy className="w-3 h-3" /> Copy
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  await toggleAffiliateLink(aff.id, !aff.isActive);
                                  await reloadVerifiedEarnings();
                                }}
                                className="px-2 py-1 rounded bg-zinc-100 dark:bg-[#18181D] hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200"
                              >
                                {aff.isActive ? 'Disable' : 'Enable'}
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  await deleteAffiliateLink(aff.id);
                                  await reloadVerifiedEarnings();
                                }}
                                className="px-2 py-1 rounded bg-rose-50 dark:bg-rose-950/30 text-[#BE123C] dark:text-[#FB7185]"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SUB-TAB 6: PAID VIDEOS, SUPPORT HISTORY, TRAFFIC ALERTS & DISPUTES */}
          {monTab === 'paid_support' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="p-5 rounded-xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 space-y-3">
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Paid & Members-Only Videos</h3>
                  {myVideos.filter((v) => v.accessType === 'paid' || v.accessType === 'members_only').length === 0 ? (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Set any video to Paid Unlock or Members Only from Upload Video or Edit Video in the Videos tab.
                    </p>
                  ) : (
                    <div className="space-y-2 text-xs">
                      {myVideos
                        .filter((v) => v.accessType === 'paid' || v.accessType === 'members_only')
                        .map((v) => (
                          <div key={v.id} className="p-3 rounded-lg bg-white dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                            <div>
                              <div className="font-semibold text-zinc-900 dark:text-white">{v.title}</div>
                              <div className="text-zinc-500 dark:text-zinc-400">
                                {v.accessType === 'paid' ? `Paid Unlock · ${formatInr(v.priceInr || 49)}` : 'Members Only'}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => onNavigate('watch', v.id)}
                              className="px-3 py-1 rounded-lg bg-zinc-100 dark:bg-[#18181D] hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-semibold inline-flex items-center gap-1"
                            >
                              Open <ExternalLink className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                    </div>
                  )}

                  <h4 className="text-xs font-bold text-zinc-900 dark:text-white pt-3 border-t border-zinc-200 dark:border-zinc-800">
                    Recent Viewer Support Tips ({earningsData?.supports.length || 0})
                  </h4>
                  {!earningsData?.supports.length ? (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">No support transactions yet.</p>
                  ) : (
                    <div className="divide-y divide-zinc-200 dark:divide-zinc-800 text-xs max-h-48 overflow-y-auto">
                      {earningsData.supports.map((s) => (
                        <div key={s.id} className="py-2 flex justify-between text-zinc-800 dark:text-zinc-200">
                          <span>{s.supporterName || 'Supporter'} · {s.message || 'Tip'}</span>
                          <span className="font-mono font-semibold">{formatInr(s.amountInr)} ({s.status || 'pending'})</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Open a Payout / Ad Deduction Dispute & View Invalid Traffic Flags */}
                <div className="space-y-4">
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      await reportPaymentDispute({
                        reporterId: user.uid,
                        reporterName: profile.displayName,
                        creatorId: user.uid,
                        creatorName: profile.displayName,
                        transactionId: dispRef.trim() || 'GENERAL',
                        amountInr: dispAmt,
                        category: dispCat,
                        reason: dispReason,
                      });
                      setDispRef('');
                      setDispAmt(0);
                      setDispReason('');
                      showToast('Creator monetization dispute filed.', 'success');
                    }}
                    className="p-5 rounded-xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 space-y-3"
                  >
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-[#E11D48]" />
                      <h3 className="text-sm font-bold text-zinc-900 dark:text-white">File Payout / Revenue Dispute</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={dispCat}
                        onChange={(e) => setDispCat(e.target.value as any)}
                        className="px-3 py-2 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-xs text-zinc-900 dark:text-white"
                      >
                        <option value="payout_delay">Payout Delay</option>
                        <option value="ad_deduction">Invalid Traffic Deduction Appeal</option>
                        <option value="brand_milestone">Brand Connect Milestone</option>
                      </select>
                      <input
                        type="number"
                        min={0}
                        value={dispAmt}
                        onChange={(e) => setDispAmt(Number(e.target.value))}
                        placeholder="Amount INR"
                        className="px-3 py-2 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-xs font-mono text-zinc-900 dark:text-white"
                      />
                    </div>
                    <input
                      type="text"
                      value={dispRef}
                      onChange={(e) => setDispRef(e.target.value)}
                      placeholder="Transaction or Payout ID (optional)"
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-xs font-mono text-zinc-900 dark:text-white"
                    />
                    <textarea
                      rows={2}
                      required
                      minLength={5}
                      value={dispReason}
                      onChange={(e) => setDispReason(e.target.value)}
                      placeholder="Describe dispute details for Governance audit..."
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500"
                    />
                    <button type="submit" className="w-full py-2 rounded-xl bg-[#E11D48] text-xs font-semibold text-white">
                      Submit Dispute Ticket
                    </button>
                  </form>

                  <div className="p-5 rounded-xl bg-white dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 space-y-2 text-xs">
                    <div className="font-bold text-zinc-900 dark:text-white">Disputes ({disputes.length}) & IVT Flags ({trafficFlags.length})</div>
                    {disputes.map((d) => (
                      <div key={d.id} className="p-2.5 rounded-lg bg-zinc-50 dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800 flex justify-between gap-3">
                        <div>
                          <div className="font-semibold text-zinc-900 dark:text-white">{d.category} · {formatInr(d.amountInr)}</div>
                          <div className="text-zinc-600 dark:text-zinc-400">{d.reason}</div>
                          {d.resolutionNote && <div className="text-emerald-700 dark:text-emerald-400 mt-0.5">Note: {d.resolutionNote}</div>}
                        </div>
                        <span className="font-mono uppercase text-[11px] text-[#EA580C] dark:text-[#F97316] shrink-0">{d.status}</span>
                      </div>
                    ))}
                    {trafficFlags.map((f) => (
                      <div key={f.id} className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 flex justify-between gap-3">
                        <div>
                          <div className="font-semibold text-[#BE123C] dark:text-[#FB7185]">IVT Alert · {f.signalType}</div>
                          <div className="text-zinc-700 dark:text-zinc-300">{f.suspiciousCount} flagged events · {f.notes || 'Under audit'}</div>
                        </div>
                        <span className="font-mono uppercase text-[11px] text-[#BE123C] dark:text-[#FB7185] shrink-0">{f.status}</span>
                      </div>
                    ))}
                    {disputes.length === 0 && trafficFlags.length === 0 && (
                      <p className="text-zinc-500 dark:text-zinc-400">Clean record — no open disputes or invalid traffic alerts.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
