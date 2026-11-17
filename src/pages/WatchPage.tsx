import React, { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  Bookmark,
  BookmarkCheck,
  BookmarkPlus,
  Flag,
  HeartHandshake,
  ListVideo,
  MessageSquare,
  Share2,
  ThumbsDown,
  ThumbsUp,
  Tv,
  Check,
  X,
} from 'lucide-react';
import { VideoPlayer } from '../components/VideoPlayer';
import { MediaImage } from '../components/MediaImage';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import {
  addVideoComment,
  createPlaylist,
  createWatchParty,
  getUserVideoReaction,
  recordVideoShare,
  recordVideoView,
  saveWatchProgress,
  sendCreatorSupport,
  submitModerationReport,
  subscribeVideoComments,
  toggleSubscribe,
  toggleVideoInPlaylist,
  toggleVideoReaction,
  toggleWatchLater,
} from '../lib/bharatplayService';
import { formatCount, formatDuration, formatInr, formatRelativeDate } from '../lib/formatters';
import type {
  AppRoute,
  Playlist,
  Subscription,
  UserPublicProfile,
  VideoComment,
  VideoItem,
  WatchHistoryItem,
  WatchLaterItem,
} from '../types/bharatplay';

interface WatchPageProps {
  video: VideoItem;
  allVideos: VideoItem[];
  creators: UserPublicProfile[];
  subscriptions: Subscription[];
  playlists: Playlist[];
  watchHistory: WatchHistoryItem[];
  watchLater: WatchLaterItem[];
  onWatchVideo: (video: VideoItem) => void;
  onOpenChannel: (creatorId: string) => void;
  onNavigate: (route: AppRoute, param?: string) => void;
}

export function WatchPage({
  video,
  allVideos,
  creators,
  subscriptions,
  playlists,
  watchHistory,
  watchLater,
  onWatchVideo,
  onOpenChannel,
  onNavigate,
}: WatchPageProps) {
  const { user, profile } = useAuth();
  const { showToast } = useToast();

  const [comments, setComments] = useState<VideoComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [replyToId, setReplyToId] = useState<string>('');
  const [replyText, setReplyText] = useState('');
  const [reaction, setReaction] = useState<'like' | 'dislike' | null>(null);
  const [showDesc, setShowDesc] = useState(false);
  const [seekOverride, setSeekOverride] = useState<number | null>(null);

  // Modals
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [newPlaylistTitle, setNewPlaylistTitle] = useState('');
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [supportAmount, setSupportAmount] = useState(100);
  const [supportMessage, setSupportMessage] = useState('');
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [startingParty, setStartingParty] = useState(false);

  const isSubscribed = subscriptions.some((s) => s.creatorId === video.creatorId);
  const isWatchLater = watchLater.some((w) => w.videoId === video.id);
  const historyEntry = watchHistory.find((h) => h.videoId === video.id);
  const creatorProfile = creators.find((c) => c.uid === video.creatorId);

  useEffect(() => {
    const unsub = subscribeVideoComments(video.id, setComments);
    return () => unsub();
  }, [video.id]);

  useEffect(() => {
    if (user?.uid) {
      recordVideoView(video.id, video.creatorId);
      getUserVideoReaction(video.id, user.uid).then(setReaction);
    } else {
      setReaction(null);
    }
  }, [video.id, video.creatorId, user?.uid]);

  const relatedVideos = useMemo(() => {
    return allVideos
      .filter((v) => v.id !== video.id && v.type === 'video')
      .sort((a, b) => {
        const scoreA = (a.category === video.category ? 2 : 0) + (a.language === video.language ? 1 : 0);
        const scoreB = (b.category === video.category ? 2 : 0) + (b.language === video.language ? 1 : 0);
        return scoreB - scoreA;
      })
      .slice(0, 8);
  }, [allVideos, video]);

  const topComments = useMemo(() => comments.filter((c) => !c.parentCommentId), [comments]);
  const repliesMap = useMemo(() => {
    const map: Record<string, VideoComment[]> = {};
    for (const c of comments) {
      if (c.parentCommentId) {
        if (!map[c.parentCommentId]) map[c.parentCommentId] = [];
        map[c.parentCommentId].push(c);
      }
    }
    return map;
  }, [comments]);

  const requireLogin = () => {
    showToast('Please sign in to interact on BharatPlay.', 'info');
    onNavigate('login');
  };

  const handleReact = async (type: 'like' | 'dislike') => {
    if (!user || !profile) return requireLogin();
    try {
      const next = await toggleVideoReaction(video.id, user.uid, type, reaction, {
        creatorId: video.creatorId,
        actorName: profile.displayName,
        videoTitle: video.title,
      });
      setReaction(next);
    } catch {
      showToast('Could not update reaction.', 'error');
    }
  };

  const handleSubscribe = async () => {
    if (!user || !profile) return requireLogin();
    try {
      const next = await toggleSubscribe(
        profile,
        { uid: video.creatorId, displayName: video.creatorName, avatarUrl: video.creatorAvatar },
        isSubscribed
      );
      showToast(next ? `Subscribed to ${video.creatorName}` : 'Unsubscribed', 'success');
    } catch {
      showToast('Could not update subscription.', 'error');
    }
  };

  const handleWatchLater = async () => {
    if (!user) return requireLogin();
    try {
      const saved = await toggleWatchLater(user.uid, video, isWatchLater);
      showToast(saved ? 'Saved to Watch Later' : 'Removed from Watch Later', 'success');
    } catch {
      showToast('Could not update Watch Later.', 'error');
    }
  };

  const handleStartWatchParty = async () => {
    if (!user || !profile) return requireLogin();
    setStartingParty(true);
    try {
      const room = await createWatchParty({
        host: profile,
        title: `${video.title.slice(0, 60)} — Watch Party`,
        video,
        isPrivate: true,
      });
      showToast(`Watch Party created! Invite code: ${room.inviteCode}`, 'success');
      onNavigate('watch-party', room.id);
    } catch {
      showToast('Could not start Watch Party.', 'error');
    } finally {
      setStartingParty(false);
    }
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/?watch=${video.id}`;
    recordVideoShare(video.id);
    try {
      if (navigator.share) {
        await navigator.share({ title: video.title, url: shareUrl });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        showToast('Video link copied to clipboard.', 'success');
      }
    } catch {
      showToast('Share link ready.', 'info');
    }
  };

  const handleAddComment = async (e: React.FormEvent, parentId = '') => {
    e.preventDefault();
    if (!user || !profile) return requireLogin();
    const text = parentId ? replyText : commentText;
    if (!text.trim()) return;
    try {
      await addVideoComment(video.id, profile, text, parentId, {
        creatorId: video.creatorId,
        videoTitle: video.title,
      });
      if (parentId) {
        setReplyText('');
        setReplyToId('');
      } else {
        setCommentText('');
      }
      showToast('Comment posted.', 'success');
    } catch {
      showToast('Unable to post comment right now.', 'error');
    }
  };

  const handleCreateAndSavePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile || !newPlaylistTitle.trim()) return;
    try {
      await createPlaylist(profile, newPlaylistTitle, '', 'public', video.id, video.thumbnailUrl);
      setNewPlaylistTitle('');
      showToast('Playlist created and video saved.', 'success');
    } catch {
      showToast('Could not create playlist.', 'error');
    }
  };

  const handleSendSupport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return requireLogin();
    try {
      await sendCreatorSupport({
        supporter: profile,
        creatorId: video.creatorId,
        creatorName: video.creatorName,
        amountInr: supportAmount,
        message: supportMessage,
      });
      setShowSupportModal(false);
      setSupportMessage('');
      showToast(`Sent ${formatInr(supportAmount)} Creator Support to ${video.creatorName}!`, 'success');
    } catch {
      showToast('Could not process Creator Support.', 'error');
    }
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return requireLogin();
    if (!reportReason.trim()) return;
    try {
      await submitModerationReport({
        reporterId: user.uid,
        targetType: 'video',
        targetId: video.id,
        targetTitle: video.title,
        reason: reportReason,
      });
      setShowReportModal(false);
      setReportReason('');
      showToast('Report submitted to BharatPlay Moderation.', 'success');
    } catch {
      showToast('Failed to submit report.', 'error');
    }
  };

  return (
    <div className="max-w-[1440px] mx-auto px-4 md:px-6 lg:px-8 py-5 grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Main Watch Column */}
      <div className="lg:col-span-8 space-y-5">
        <VideoPlayer
          src={video.videoUrl}
          poster={video.thumbnailUrl}
          title={video.title}
          chapters={video.chapters || []}
          initialTime={seekOverride ?? (historyEntry?.progressSeconds || 0)}
          externalSync={
            seekOverride !== null
              ? { isPlaying: true, currentTime: seekOverride, seq: Date.now() }
              : null
          }
          onProgress={(sec) => {
            if (user?.uid) {
              saveWatchProgress(user.uid, video, sec, historyEntry?.maxProgressSeconds || 0);
            }
          }}
        />

        <div className="space-y-4">
          <h1 className="text-xl md:text-2xl font-bold font-display text-zinc-900 leading-snug">
            {video.title}
          </h1>

          {/* Creator & Action Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-200">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => onOpenChannel(video.creatorId)}
                className="w-11 h-11 rounded-full overflow-hidden border border-zinc-200 shrink-0"
              >
                <MediaImage
                  src={video.creatorAvatar}
                  alt={video.creatorName}
                  className="w-full h-full object-cover"
                />
              </button>
              <div>
                <button
                  type="button"
                  onClick={() => onOpenChannel(video.creatorId)}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-900 hover:text-[#EA580C] transition-colors"
                >
                  <span>{video.creatorName}</span>
                  {creatorProfile?.isVerified && (
                    <BadgeCheck className="w-4 h-4 text-[#EA580C]" />
                  )}
                </button>
                <div className="text-xs text-zinc-500">
                  {video.category} · {video.language}
                </div>
              </div>

              <button
                type="button"
                onClick={handleSubscribe}
                className={`ml-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
                  isSubscribed
                    ? 'bg-zinc-100 text-zinc-800 border border-zinc-200 hover:bg-zinc-200'
                    : 'bg-[#E11D48] hover:bg-[#BE123C] text-white'
                }`}
              >
                {isSubscribed ? 'Subscribed' : 'Subscribe'}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center rounded-xl bg-zinc-50 border border-zinc-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => handleReact('like')}
                  className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium transition-colors ${
                    reaction === 'like' ? 'text-[#BE123C] bg-rose-50' : 'text-zinc-700 hover:bg-zinc-100'
                  }`}
                >
                  <ThumbsUp className="w-4 h-4" />
                  <span className="tabular-nums">{formatCount(video.likesCount)}</span>
                </button>
                <div className="w-px h-5 bg-zinc-200" />
                <button
                  type="button"
                  onClick={() => handleReact('dislike')}
                  aria-label="Dislike video"
                  className={`flex items-center gap-1 px-3 py-2 text-xs transition-colors ${
                    reaction === 'dislike' ? 'text-[#EA580C] bg-orange-50' : 'text-zinc-500 hover:bg-zinc-100'
                  }`}
                >
                  <ThumbsDown className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={handleWatchLater}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-medium transition-colors ${
                  isWatchLater
                    ? 'bg-rose-50 border-rose-200 text-[#BE123C]'
                    : 'bg-zinc-50 hover:bg-zinc-100 border-zinc-200 text-zinc-700'
                }`}
              >
                {isWatchLater ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                <span>{isWatchLater ? 'In Watch Later' : 'Watch Later'}</span>
              </button>

              <button
                type="button"
                onClick={handleStartWatchParty}
                disabled={startingParty}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-xs font-semibold text-[#BE123C] transition-colors whitespace-nowrap"
              >
                <Tv className="w-4 h-4" />
                <span>{startingParty ? 'Creating...' : 'Watch Party'}</span>
              </button>

              <button
                type="button"
                onClick={() => (user ? setShowSupportModal(true) : requireLogin())}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-orange-50 hover:bg-orange-100 border border-orange-200 text-xs font-semibold text-[#EA580C] transition-colors whitespace-nowrap"
              >
                <HeartHandshake className="w-4 h-4" />
                <span>Support</span>
              </button>

              <button
                type="button"
                onClick={handleShare}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-xs font-medium text-zinc-700 transition-colors"
              >
                <Share2 className="w-4 h-4" />
                <span>Share</span>
              </button>

              <button
                type="button"
                onClick={() => (user ? setShowPlaylistModal(true) : requireLogin())}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-xs font-medium text-zinc-700 transition-colors"
              >
                <BookmarkPlus className="w-4 h-4" />
                <span>Playlist</span>
              </button>

              <button
                type="button"
                onClick={() => (user ? setShowReportModal(true) : requireLogin())}
                aria-label="Report video"
                className="p-2 rounded-xl bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-zinc-500 hover:text-zinc-900 transition-colors"
              >
                <Flag className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Chapters Bar */}
          {video.chapters && video.chapters.length > 0 && (
            <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-900">
                <ListVideo className="w-4 h-4 text-[#EA580C]" />
                <span>Video Chapters</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {video.chapters.map((ch, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSeekOverride(ch.timeSeconds)}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white hover:bg-zinc-100 border border-zinc-200 text-xs text-zinc-800 transition-colors"
                  >
                    <span className="font-mono text-[#EA580C]">{formatDuration(ch.timeSeconds)}</span>
                    <span>{ch.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Description Box */}
          <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-zinc-700 tabular-nums">
              <span>{formatCount(video.viewsCount)} views</span>
              <span aria-hidden="true">·</span>
              <span>{formatRelativeDate(video.createdAt)}</span>
              <span aria-hidden="true">·</span>
              <span className="text-[#EA580C] font-semibold">{video.language}</span>
            </div>
            <p className={`text-sm text-zinc-700 leading-relaxed whitespace-pre-line ${showDesc ? '' : 'line-clamp-2'}`}>
              {video.description || 'Published on BharatPlay.'}
            </p>
            {video.tags && video.tags.length > 0 && (
              <div className="text-xs text-zinc-500 pt-1">
                {video.tags.map((t) => `#${t}`).join('  ')}
              </div>
            )}
            <button
              type="button"
              onClick={() => setShowDesc((s) => !s)}
              className="text-xs font-semibold text-zinc-900 hover:text-[#EA580C]"
            >
              {showDesc ? 'Show less' : 'Show more'}
            </button>
          </div>
        </div>

        {/* Comments Section */}
        <section className="space-y-5 pt-2">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-zinc-500" />
            <h2 className="text-base font-bold font-display text-zinc-900 tabular-nums">
              {comments.length} Comments
            </h2>
          </div>

          <form onSubmit={(e) => handleAddComment(e, '')} className="flex gap-3">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder={user ? 'Add a comment to the conversation...' : 'Sign in to join the conversation'}
              className="flex-1 px-4 py-2.5 rounded-xl bg-white border border-zinc-300 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-[#E11D48]"
            />
            <button
              type="submit"
              className="px-4 py-2.5 rounded-xl bg-[#E11D48] hover:bg-[#BE123C] text-xs font-semibold text-white whitespace-nowrap"
            >
              Comment
            </button>
          </form>

          <div className="space-y-4">
            {topComments.length === 0 ? (
              <p className="text-sm text-zinc-500 py-4">Be the first to comment on this video.</p>
            ) : (
              topComments.map((cmt) => (
                <div key={cmt.id} className="space-y-3 pb-4 border-b border-zinc-200">
                  <div className="flex items-start gap-3">
                    <MediaImage
                      src={cmt.authorAvatar}
                      alt={cmt.authorName}
                      className="w-8 h-8 rounded-full object-cover shrink-0 border border-zinc-200"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-semibold text-zinc-900">{cmt.authorName}</span>
                        <span className="text-zinc-500">{formatRelativeDate(cmt.createdAt)}</span>
                      </div>
                      <p className="text-sm text-zinc-700 mt-1 leading-relaxed">{cmt.text}</p>
                      <button
                        type="button"
                        onClick={() => setReplyToId(replyToId === cmt.id ? '' : cmt.id)}
                        className="mt-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900"
                      >
                        Reply
                      </button>

                      {replyToId === cmt.id && (
                        <form onSubmit={(e) => handleAddComment(e, cmt.id)} className="mt-2 flex gap-2">
                          <input
                            type="text"
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder={`Reply to ${cmt.authorName}...`}
                            className="flex-1 px-3 py-1.5 rounded-lg bg-white border border-zinc-300 text-xs text-zinc-900 focus:outline-none focus:border-[#F97316]"
                          />
                          <button
                            type="submit"
                            className="px-3 py-1.5 rounded-lg bg-[#F97316] text-xs font-semibold text-white"
                          >
                            Reply
                          </button>
                        </form>
                      )}

                      {repliesMap[cmt.id]?.map((rep) => (
                        <div key={rep.id} className="mt-3 pl-4 border-l border-zinc-200 flex items-start gap-2.5">
                          <MediaImage
                            src={rep.authorAvatar}
                            alt={rep.authorName}
                            className="w-6 h-6 rounded-full object-cover shrink-0 border border-zinc-200"
                          />
                          <div>
                            <div className="flex items-center gap-2 text-xs">
                              <span className="font-semibold text-zinc-900">{rep.authorName}</span>
                              <span className="text-zinc-500">{formatRelativeDate(rep.createdAt)}</span>
                            </div>
                            <p className="text-xs text-zinc-700 mt-0.5">{rep.text}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Right Column: Related Videos */}
      <aside className="lg:col-span-4 space-y-4">
        <h2 className="text-base font-bold font-display text-zinc-900">Up Next</h2>
        <div className="space-y-3">
          {relatedVideos.map((rel) => (
            <button
              key={rel.id}
              type="button"
              onClick={() => onWatchVideo(rel)}
              className="w-full flex items-start gap-3 p-2 rounded-xl hover:bg-zinc-50 text-left transition-colors group"
            >
              <div className="w-40 aspect-video rounded-lg overflow-hidden shrink-0 bg-zinc-100 border border-zinc-200">
                <MediaImage
                  src={rel.thumbnailUrl}
                  alt={rel.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-zinc-900 line-clamp-2 leading-snug group-hover:text-[#EA580C]">
                  {rel.title}
                </h3>
                <div className="text-xs text-zinc-600 mt-1 truncate">{rel.creatorName}</div>
                <div className="text-xs text-zinc-500 mt-0.5 tabular-nums">
                  {formatCount(rel.viewsCount)} views · {rel.language}
                </div>
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* Save to Playlist Modal */}
      {showPlaylistModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-zinc-200 rounded-2xl p-6 space-y-4 shadow-2xl text-zinc-900">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">Save to Playlist</h3>
              <button type="button" onClick={() => setShowPlaylistModal(false)} className="text-zinc-500 hover:text-zinc-900">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {playlists.length === 0 ? (
                <p className="text-xs text-zinc-500">You don’t have any playlists yet.</p>
              ) : (
                playlists.map((pl) => {
                  const included = pl.videoIds.includes(video.id);
                  return (
                    <button
                      key={pl.id}
                      type="button"
                      onClick={async () => {
                        const added = await toggleVideoInPlaylist(pl, video.id, video.thumbnailUrl);
                        showToast(added ? `Added to ${pl.title}` : `Removed from ${pl.title}`, 'success');
                      }}
                      className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-sm text-zinc-900"
                    >
                      <span className="truncate">{pl.title}</span>
                      {included && <Check className="w-4 h-4 text-[#EA580C] shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>
            <form onSubmit={handleCreateAndSavePlaylist} className="flex gap-2 pt-2 border-t border-zinc-200">
              <input
                type="text"
                value={newPlaylistTitle}
                onChange={(e) => setNewPlaylistTitle(e.target.value)}
                placeholder="New playlist name..."
                className="flex-1 px-3 py-2 rounded-xl bg-white border border-zinc-300 text-xs text-zinc-900"
              />
              <button
                type="submit"
                className="px-3.5 py-2 rounded-xl bg-[#E11D48] text-xs font-semibold text-white"
              >
                Create
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Support Creator Modal */}
      {showSupportModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSendSupport}
            className="w-full max-w-md bg-white border border-zinc-200 rounded-2xl p-6 space-y-4 shadow-2xl text-zinc-900"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">Support {video.creatorName}</h3>
              <button type="button" onClick={() => setShowSupportModal(false)} className="text-zinc-500 hover:text-zinc-900">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-zinc-600">
              100% of Creator Support contributions empower independent Indian creators directly.
            </p>
            <div className="grid grid-cols-4 gap-2">
              {[50, 100, 250, 500].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setSupportAmount(amt)}
                  className={`py-2 rounded-xl text-xs font-mono font-semibold border ${
                    supportAmount === amt
                      ? 'bg-[#F97316] border-[#F97316] text-white'
                      : 'bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-zinc-100'
                  }`}
                >
                  ₹{amt}
                </button>
              ))}
            </div>
            <input
              type="text"
              maxLength={280}
              value={supportMessage}
              onChange={(e) => setSupportMessage(e.target.value)}
              placeholder="Add an encouraging note (optional)"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-zinc-300 text-xs text-zinc-900"
            />
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-[#E11D48] hover:bg-[#BE123C] text-sm font-semibold text-white"
            >
              Send {formatInr(supportAmount)} Support
            </button>
          </form>
        </div>
      )}

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleReportSubmit}
            className="w-full max-w-md bg-white border border-zinc-200 rounded-2xl p-6 space-y-4 shadow-2xl text-zinc-900"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">Report Content</h3>
              <button type="button" onClick={() => setShowReportModal(false)} className="text-zinc-500 hover:text-zinc-900">
                <X className="w-5 h-5" />
              </button>
            </div>
            <textarea
              rows={3}
              required
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="Describe the policy or safety issue..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-zinc-300 text-sm text-zinc-900"
            />
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-[#E11D48] text-sm font-semibold text-white"
            >
              Submit Report
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
