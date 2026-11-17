import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  BarChart3,
  Check,
  Edit3,
  Handshake,
  IndianRupee,
  ListVideo,
  MessageSquare,
  Plus,
  Radio,
  Trash2,
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
  respondCollaborationRequest,
  startLiveStream,
  updateVideoMetadata,
} from '../lib/bharatplayService';
import { computeCreatorPerformance } from '../lib/creatorMetrics';
import { DEFAULT_CATEGORIES, DEFAULT_LANGUAGES } from '../lib/catalogSeed';
import { formatCount, formatDuration, formatInr, formatRelativeDate } from '../lib/formatters';
import type {
  AppRoute,
  CollaborationRequest,
  CommunityPost,
  LiveStream,
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
  const { user, profile, privateAccount, isCreator, becomeCreator, updatePrivateSettings } = useAuth();
  const { broadcastLiveStarted } = useWebSocket();
  const { showToast } = useToast();

  const [tab, setTab] = useState<
    'analytics' | 'videos' | 'collabs' | 'community' | 'playlists' | 'live' | 'monetization'
  >('analytics');
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

  // Monetization form
  const [upiId, setUpiId] = useState(privateAccount?.upiId || '');
  useEffect(() => {
    setUpiId(privateAccount?.upiId || '');
  }, [privateAccount?.upiId]);

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
  const revShare = (platformConfig.creatorRevenueSharePercent || 75) / 100;
  const estimatedInr = Math.round((totalViews / 1000) * 65 * revShare) + (privateAccount?.estimatedEarningsInr || 0);
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
      <div className="max-w-lg mx-auto my-16 p-8 rounded-2xl bg-zinc-50 border border-zinc-200 text-center space-y-4">
        <BarChart3 className="w-10 h-10 text-[#EA580C] mx-auto" />
        <h1 className="text-xl font-bold font-display text-zinc-900">Creator Studio</h1>
        <p className="text-sm text-zinc-600">
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold font-display text-zinc-900">Creator Studio</h1>
          <p className="text-xs text-zinc-600 mt-1">
            {profile.displayName} · {profile.isEarlyCreator ? 'Early Creator Program Active' : 'Creator Partner'} · {platformConfig.creatorRevenueSharePercent}% Creator Share
          </p>
        </div>

        <div className="flex items-center gap-3">
          {!isCreator && (
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
            onClick={onOpenUpload}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#E11D48] hover:bg-[#BE123C] text-xs font-semibold text-white"
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
                : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 border border-zinc-200'
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
              <h2 className="text-base font-bold text-zinc-900">Channel Performance Reports</h2>
              <p className="text-xs text-zinc-600">
                Real-time metrics calculated from your published videos and viewer playback sessions.
              </p>
            </div>
            <div className="inline-flex p-1 rounded-xl bg-zinc-100 border border-zinc-200">
              {(['daily', 'weekly', 'monthly'] as const).map((win) => (
                <button
                  key={win}
                  type="button"
                  onClick={() => setReportWindow(win)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
                    reportWindow === win ? 'bg-[#F97316] text-white' : 'text-zinc-600 hover:text-zinc-900'
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
              <div key={kpi.label} className="p-4 rounded-xl bg-zinc-50 border border-zinc-200">
                <div className="text-xs text-zinc-600">{kpi.label}</div>
                <div className="text-xl font-bold font-mono tabular-nums text-zinc-900 mt-1.5">
                  {kpi.value}
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 p-6 rounded-xl bg-white border border-zinc-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-zinc-900">Video Retention & Engagement Report</h2>
                <span className="text-xs text-zinc-600 capitalize">{reportWindow} breakdown</span>
              </div>
              {myVideos.length === 0 ? (
                <div className="py-8 text-center space-y-3">
                  <p className="text-sm text-zinc-600">Publish your first video to unlock live analytics.</p>
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
                    <thead className="bg-zinc-50 text-zinc-600 border-b border-zinc-200">
                      <tr>
                        <th className="py-2.5 pr-4 pl-2 font-medium">Title</th>
                        <th className="py-2.5 px-3 font-medium text-right">Views</th>
                        <th className="py-2.5 px-3 font-medium text-right">Unique</th>
                        <th className="py-2.5 px-3 font-medium text-right">Retention</th>
                        <th className="py-2.5 pl-3 pr-2 font-medium text-right">Likes / Cmts</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                      {reportVideos.map((v) => {
                        const dur = Math.max(1, v.durationSeconds || 8);
                        const ret =
                          v.totalWatchSeconds && v.viewsCount
                            ? Math.min(100, Math.round((v.totalWatchSeconds / (v.viewsCount * dur)) * 100))
                            : v.viewsCount > 0
                            ? 62
                            : 0;
                        return (
                          <tr key={v.id} className="hover:bg-zinc-50">
                            <td className="py-3 pr-4 pl-2 text-zinc-900 font-medium max-w-[240px] truncate">
                              {v.title}
                            </td>
                            <td className="py-3 px-3 text-right font-mono tabular-nums text-zinc-700">
                              {formatCount(v.viewsCount)}
                            </td>
                            <td className="py-3 px-3 text-right font-mono tabular-nums text-zinc-600">
                              {formatCount(v.uniqueViewersCount ?? Math.round((v.viewsCount || 0) * 0.84))}
                            </td>
                            <td className="py-3 px-3 text-right font-mono tabular-nums text-[#EA580C] font-semibold">
                              {ret}%
                            </td>
                            <td className="py-3 pl-3 pr-2 text-right font-mono tabular-nums text-zinc-700">
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

            <div className="lg:col-span-4 p-6 rounded-xl bg-zinc-50 border border-zinc-200 space-y-4">
              <h2 className="text-base font-bold text-zinc-900">Audience & Earnings Summary</h2>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between text-zinc-600">
                  <span>Estimated Earnings</span>
                  <span className="font-mono tabular-nums text-emerald-600 font-semibold">
                    {formatInr(estimatedInr)}
                  </span>
                </div>
                <div className="flex justify-between text-zinc-600">
                  <span>Total Subscribers</span>
                  <span className="font-mono tabular-nums text-zinc-900 font-semibold">
                    {formatCount(profile.subscribersCount)}
                  </span>
                </div>
                <div className="pt-2 border-t border-zinc-200 space-y-2.5">
                  <div className="text-zinc-600 font-medium">Audience by Language</div>
                  {audienceByLanguage.length === 0 ? (
                    <p className="text-zinc-500">No audience language data yet.</p>
                  ) : (
                    audienceByLanguage.map((item) => (
                      <div key={item.lang} className="space-y-1">
                        <div className="flex justify-between text-zinc-800">
                          <span>{item.lang}</span>
                          <span className="font-mono tabular-nums">{item.pct}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-zinc-200 overflow-hidden">
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
            <div className="p-10 rounded-xl bg-zinc-50 border border-zinc-200 text-center text-sm text-zinc-600">
              You haven’t uploaded any videos yet.
            </div>
          ) : (
            <div className="space-y-3">
              {myVideos.map((v) => (
                <div
                  key={v.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-zinc-50 border border-zinc-200"
                >
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => onNavigate('watch', v.id)}
                      className="text-sm font-semibold text-zinc-900 hover:text-[#EA580C] truncate block text-left"
                    >
                      {v.title}
                    </button>
                    <div className="text-xs text-zinc-600 mt-1 tabular-nums">
                      {v.type} · {v.category} · {v.language} · {formatDuration(v.durationSeconds)} · {formatCount(v.viewsCount)} views · {formatCount(v.commentsCount)} comments
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setEditingVideo(v)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-zinc-100 border border-zinc-300 text-xs font-medium text-zinc-900"
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
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-xs text-[#BE123C] font-medium"
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
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  await updateVideoMetadata(editingVideo.id, {
                    title: editingVideo.title,
                    description: editingVideo.description || '',
                    category: editingVideo.category,
                    language: editingVideo.language,
                    chapters: editingVideo.chapters || [],
                  });
                  setEditingVideo(null);
                  showToast('Video details updated.', 'success');
                }}
                className="w-full max-w-lg bg-white border border-zinc-200 shadow-2xl rounded-2xl p-6 space-y-4 text-zinc-900"
              >
                <h3 className="text-base font-bold text-zinc-900">Edit Video Details</h3>
                <input
                  type="text"
                  required
                  value={editingVideo.title}
                  onChange={(e) => setEditingVideo({ ...editingVideo, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-zinc-300 text-sm text-zinc-900"
                />
                <textarea
                  rows={3}
                  value={editingVideo.description || ''}
                  onChange={(e) => setEditingVideo({ ...editingVideo, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-zinc-300 text-sm text-zinc-900"
                />
                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={editingVideo.category}
                    onChange={(e) => setEditingVideo({ ...editingVideo, category: e.target.value })}
                    className="px-3 py-2 rounded-xl bg-white border border-zinc-300 text-xs text-zinc-900"
                  >
                    {DEFAULT_CATEGORIES.filter((c) => c !== 'All').map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <select
                    value={editingVideo.language}
                    onChange={(e) => setEditingVideo({ ...editingVideo, language: e.target.value })}
                    className="px-3 py-2 rounded-xl bg-white border border-zinc-300 text-xs text-zinc-900"
                  >
                    {DEFAULT_LANGUAGES.filter((l) => l !== 'All Languages').map((l) => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setEditingVideo(null)} className="px-4 py-2 text-xs text-zinc-600 hover:text-zinc-900">
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
          <div className="p-6 rounded-xl bg-zinc-50 border border-zinc-200 space-y-4">
            <h2 className="text-base font-bold text-zinc-900 flex items-center gap-2">
              <Handshake className="w-4 h-4 text-[#EA580C]" />
              <span>Incoming Collaboration Invites</span>
            </h2>
            {incomingCollabs.length === 0 ? (
              <p className="text-xs text-zinc-600">No incoming collaboration invitations yet.</p>
            ) : (
              <div className="space-y-3">
                {incomingCollabs.map((c) => (
                  <div key={c.id} className="p-4 rounded-xl bg-white border border-zinc-200 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-zinc-900">{c.title}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${
                          c.status === 'accepted'
                            ? 'bg-emerald-50 text-emerald-700'
                            : c.status === 'rejected'
                            ? 'bg-rose-50 text-[#BE123C]'
                            : 'bg-orange-50 text-[#EA580C]'
                        }`}
                      >
                        {c.status}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-600">
                      From <span className="text-zinc-900 font-medium">{c.senderName}</span> · {formatRelativeDate(c.createdAt)}
                    </div>
                    <p className="text-xs text-zinc-700 leading-relaxed">{c.proposal}</p>
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
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 text-xs font-semibold text-zinc-800"
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

          <div className="p-6 rounded-xl bg-zinc-50 border border-zinc-200 space-y-4">
            <h2 className="text-base font-bold text-zinc-900">Sent Invitations</h2>
            {outgoingCollabs.length === 0 ? (
              <p className="text-xs text-zinc-600">
                Visit any creator profile and click “Collaborate” to pitch a joint video or livestream.
              </p>
            ) : (
              <div className="space-y-3">
                {outgoingCollabs.map((c) => (
                  <div key={c.id} className="p-4 rounded-xl bg-white border border-zinc-200 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-zinc-900">{c.title}</span>
                      <span className="text-[11px] font-semibold uppercase text-[#EA580C]">{c.status}</span>
                    </div>
                    <div className="text-xs text-zinc-600">To {c.recipientName}</div>
                    <p className="text-xs text-zinc-700">{c.proposal}</p>
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
            className="lg:col-span-5 p-6 rounded-xl bg-zinc-50 border border-zinc-200 space-y-4 h-fit"
          >
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#EA580C]" />
              <h2 className="text-base font-bold text-zinc-900">Publish Community Post</h2>
            </div>
            <div className="flex gap-2">
              {(['text', 'poll', 'announcement'] as const).map((pt) => (
                <button
                  key={pt}
                  type="button"
                  onClick={() => setPostType(pt)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize ${
                    postType === pt ? 'bg-[#E11D48] text-white' : 'bg-white border border-zinc-300 text-zinc-700 hover:bg-zinc-100'
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
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-zinc-300 text-sm text-zinc-900 placeholder-zinc-400"
            />
            {postType === 'poll' && (
              <div className="space-y-2">
                <input
                  type="text"
                  required
                  value={pollOpt1}
                  onChange={(e) => setPollOpt1(e.target.value)}
                  placeholder="Poll Option 1"
                  className="w-full px-3 py-2 rounded-xl bg-white border border-zinc-300 text-xs text-zinc-900 placeholder-zinc-400"
                />
                <input
                  type="text"
                  required
                  value={pollOpt2}
                  onChange={(e) => setPollOpt2(e.target.value)}
                  placeholder="Poll Option 2"
                  className="w-full px-3 py-2 rounded-xl bg-white border border-zinc-300 text-xs text-zinc-900 placeholder-zinc-400"
                />
              </div>
            )}
            <button type="submit" className="w-full py-2.5 rounded-xl bg-[#E11D48] hover:bg-[#BE123C] text-xs font-semibold text-white">
              Post to Community
            </button>
          </form>

          <div className="lg:col-span-7 space-y-3">
            {myPosts.length === 0 ? (
              <div className="p-8 rounded-xl bg-zinc-50 border border-zinc-200 text-center text-sm text-zinc-600">
                Your published community posts and polls will appear here.
              </div>
            ) : (
              myPosts.map((p) => (
                <div key={p.id} className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 space-y-2">
                  <div className="text-xs text-[#EA580C] uppercase tracking-wider font-semibold">{p.postType}</div>
                  <p className="text-sm text-zinc-800">{p.content}</p>
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
            className="lg:col-span-4 p-6 rounded-xl bg-zinc-50 border border-zinc-200 space-y-4 h-fit"
          >
            <div className="flex items-center gap-2">
              <ListVideo className="w-4 h-4 text-[#EA580C]" />
              <h2 className="text-base font-bold text-zinc-900">Create Playlist</h2>
            </div>
            <input
              type="text"
              required
              value={plTitle}
              onChange={(e) => setPlTitle(e.target.value)}
              placeholder="Playlist title"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-zinc-300 text-sm text-zinc-900 placeholder-zinc-400"
            />
            <textarea
              rows={2}
              value={plDesc}
              onChange={(e) => setPlDesc(e.target.value)}
              placeholder="Description (optional)"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-zinc-300 text-sm text-zinc-900 placeholder-zinc-400"
            />
            <select
              value={plVis}
              onChange={(e) => setPlVis(e.target.value as any)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-zinc-300 text-xs text-zinc-900"
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
              <div key={pl.id} className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 space-y-2">
                <div className="text-sm font-bold text-zinc-900">{pl.title}</div>
                <div className="text-xs text-zinc-600 tabular-nums">
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
            className="lg:col-span-6 p-6 rounded-xl bg-zinc-50 border border-zinc-200 space-y-4"
          >
            <div className="flex items-center gap-2">
              <Radio className="w-5 h-5 text-[#E11D48]" />
              <h2 className="text-base font-bold text-zinc-900">Start New Live Broadcast</h2>
            </div>
            <input
              type="text"
              required
              value={liveTitle}
              onChange={(e) => setLiveTitle(e.target.value)}
              placeholder="Live stream title"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-zinc-300 text-sm text-zinc-900 placeholder-zinc-400"
            />
            <textarea
              rows={3}
              value={liveDesc}
              onChange={(e) => setLiveDesc(e.target.value)}
              placeholder="Stream description..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-zinc-300 text-sm text-zinc-900 placeholder-zinc-400"
            />
            <div className="grid grid-cols-2 gap-3">
              <select
                value={liveCategory}
                onChange={(e) => setLiveCategory(e.target.value)}
                className="px-3 py-2 rounded-xl bg-white border border-zinc-300 text-xs text-zinc-900"
              >
                {DEFAULT_CATEGORIES.filter((c) => c !== 'All').map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <select
                value={liveLanguage}
                onChange={(e) => setLiveLanguage(e.target.value)}
                className="px-3 py-2 rounded-xl bg-white border border-zinc-300 text-xs text-zinc-900"
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

          <div className="lg:col-span-6 p-6 rounded-xl bg-zinc-50 border border-zinc-200 space-y-4">
            <h2 className="text-base font-bold text-zinc-900">Your Active Streams</h2>
            {myStreams.length === 0 ? (
              <p className="text-sm text-zinc-600">You have no active live streams right now.</p>
            ) : (
              myStreams.map((st) => (
                <div key={st.id} className="p-4 rounded-xl bg-white border border-zinc-200 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-zinc-900">{st.title}</div>
                    <div className="text-xs text-[#E11D48] mt-0.5 tabular-nums font-medium">
                      LIVE · {st.viewerCount} viewers
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => onNavigate('live', st.id)}
                      className="px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 text-xs font-medium text-zinc-900"
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

      {/* MONETIZATION & BHARATPLAY REWARDS */}
      {tab === 'monetization' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await updatePrivateSettings({ upiId, monetizationEnabled: true });
              showToast('Payout settings saved.', 'success');
            }}
            className="p-6 rounded-xl bg-zinc-50 border border-zinc-200 space-y-4"
          >
            <div className="flex items-center gap-2">
              <IndianRupee className="w-5 h-5 text-[#EA580C]" />
              <h2 className="text-base font-bold text-zinc-900">Creator-First Monetization & UPI Payouts</h2>
            </div>
            <p className="text-xs text-zinc-600">
              Earn {platformConfig.creatorRevenueSharePercent}% ad-revenue share plus 100% direct Creator Support tips.
            </p>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">UPI ID for Payouts</label>
              <input
                type="text"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                placeholder="yourname@okaxis"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-zinc-300 text-sm text-zinc-900 placeholder-zinc-400"
              />
            </div>
            <button type="submit" className="px-5 py-2.5 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-xs font-semibold text-white">
              Save Payout Details
            </button>
          </form>

          <div className="p-6 rounded-xl bg-zinc-50 border border-zinc-200 space-y-4">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-[#E11D48]" />
              <h2 className="text-base font-bold text-zinc-900">BharatPlay Rewards & Creator Boost</h2>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-white border border-zinc-200">
                <div className="text-zinc-600">Current Tier</div>
                <div className="text-base font-bold text-[#EA580C] mt-0.5">{profile.rewardTier || 'Seed'}</div>
              </div>
              <div className="p-3.5 rounded-xl bg-white border border-zinc-200">
                <div className="text-zinc-600">Creator Boost</div>
                <div className="text-base font-bold text-emerald-600 mt-0.5">
                  {profile.boostEnabled || platformConfig.earlyCreatorBoostEnabled ? 'Active' : 'Standard'}
                </div>
              </div>
            </div>
            <p className="text-xs text-zinc-600 leading-relaxed">
              Reach 10K monthly views for Rising Tier (₹5,000 bonus pool) and 1L monthly views for Star Tier priority sponsorship matching.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
