import React, { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  Bookmark,
  BookmarkCheck,
  BookmarkPlus,
  Clock,
  Crown,
  ExternalLink,
  Flag,
  HeartHandshake,
  ListVideo,
  Lock,
  MessageSquare,
  Share2,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
  Tv,
  Check,
  X,
} from 'lucide-react';
import { VideoPlayer } from '../components/VideoPlayer';
import { MediaImage } from '../components/MediaImage';
import { UpiQrPaymentModal, type UpiQrPaymentRequest } from '../components/UpiQrPaymentModal';
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
  submitModerationReport,
  subscribeVideoComments,
  toggleSubscribe,
  toggleVideoInPlaylist,
  toggleVideoReaction,
  toggleWatchLater,
} from '../lib/bharatplayService';
import {
  reportPaymentDispute,
  sendTrafficSignal,
  subscribeAffiliateLinks,
  subscribeMembershipPlans,
  subscribeUserMemberships,
  subscribeUserPaymentTransactions,
  subscribeUserVideoPurchases,
} from '../lib/monetizationService';
import { formatCount, formatDuration, formatInr, formatRelativeDate } from '../lib/formatters';
import type {
  AffiliateLink,
  AppRoute,
  CreatorMembership,
  MembershipPlan,
  PaymentTransaction,
  Playlist,
  Subscription,
  UserPublicProfile,
  VideoComment,
  VideoItem,
  VideoPurchase,
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
  const { user, profile, isCeo } = useAuth();
  const { showToast } = useToast();

  const [comments, setComments] = useState<VideoComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [replyToId, setReplyToId] = useState<string>('');
  const [replyText, setReplyText] = useState('');
  const [reaction, setReaction] = useState<'like' | 'dislike' | null>(null);
  const [showDesc, setShowDesc] = useState(false);
  const [seekOverride, setSeekOverride] = useState<number | null>(null);

  // Monetization & UPI QR checkout state
  const [creatorPlans, setCreatorPlans] = useState<MembershipPlan[]>([]);
  const [userMemberships, setUserMemberships] = useState<CreatorMembership[]>([]);
  const [userPurchases, setUserPurchases] = useState<VideoPurchase[]>([]);
  const [userPayments, setUserPayments] = useState<PaymentTransaction[]>([]);
  const [creatorAffiliates, setCreatorAffiliates] = useState<AffiliateLink[]>([]);
  const [qrCheckout, setQrCheckout] = useState<UpiQrPaymentRequest | null>(null);

  // Modals
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [newPlaylistTitle, setNewPlaylistTitle] = useState('');
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeCategory, setDisputeCategory] = useState<'unauthorized' | 'undelivered'>('undelivered');
  const [disputeRef, setDisputeRef] = useState('');
  const [disputeReason, setDisputeReason] = useState('');
  const [startingParty, setStartingParty] = useState(false);

  const isSubscribed = subscriptions.some((s) => s.creatorId === video.creatorId);
  const isWatchLater = watchLater.some((w) => w.videoId === video.id);
  const historyEntry = watchHistory.find((h) => h.videoId === video.id);
  const creatorProfile = creators.find((c) => c.uid === video.creatorId);

  useEffect(() => {
    const unsub1 = subscribeVideoComments(video.id, setComments);
    const unsub2 = subscribeMembershipPlans(video.creatorId, false, setCreatorPlans);
    const unsub3 = subscribeAffiliateLinks(video.creatorId, false, setCreatorAffiliates);
    return () => {
      unsub1();
      unsub2();
      unsub3();
    };
  }, [video.id, video.creatorId]);

  useEffect(() => {
    if (!user?.uid) {
      setUserMemberships([]);
      setUserPurchases([]);
      setUserPayments([]);
      return;
    }
    const u1 = subscribeUserMemberships(user.uid, setUserMemberships);
    const u2 = subscribeUserVideoPurchases(user.uid, setUserPurchases);
    const u3 = subscribeUserPaymentTransactions(user.uid, setUserPayments);
    return () => {
      u1();
      u2();
      u3();
    };
  }, [user?.uid]);

  useEffect(() => {
    sendTrafficSignal('video', video.id);
    if (user?.uid) {
      recordVideoView(video.id, video.creatorId);
      getUserVideoReaction(video.id, user.uid).then(setReaction);
    } else {
      setReaction(null);
    }
  }, [video.id, video.creatorId, user?.uid]);

  const isOwnerOrCeo = Boolean(isCeo || (user?.uid && user.uid === video.creatorId));
  const hasVerifiedPurchase = userPurchases.some(
    (p) => p.videoId === video.id && p.paymentVerified && p.status === 'verified'
  );
  const hasActiveMembership = userMemberships.some(
    (m) => m.creatorId === video.creatorId && m.paymentVerified && m.status === 'active'
  );
  const accessLockedReason =
    !isOwnerOrCeo && video.accessType === 'paid' && !hasVerifiedPurchase
      ? 'paid'
      : !isOwnerOrCeo && video.accessType === 'members_only' && !hasActiveMembership
      ? 'members_only'
      : null;

  const pendingQrAccess = userPayments.find(
    (p) =>
      p.status === 'pending_verification' &&
      ((accessLockedReason === 'paid' && p.serviceType === 'paid_video' && p.targetId === video.id) ||
        (accessLockedReason === 'members_only' && p.serviceType === 'membership' && p.creatorId === video.creatorId))
  );

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

  const openQrSupport = () => {
    if (!user || !profile) return requireLogin();
    setQrCheckout({
      serviceType: 'support',
      targetId: video.id,
      targetTitle: `Support ${video.creatorName}`,
      creatorId: video.creatorId,
      creatorName: video.creatorName,
      defaultAmountInr: 100,
      minAmountInr: 10,
      maxAmountInr: 50000,
      allowCustomAmount: true,
    });
  };

  const openQrCheckoutAccess = (kind: 'paid_video' | 'membership', targetId: string, title: string, amountInr: number) => {
    if (!user || !profile) return requireLogin();
    setQrCheckout({
      serviceType: kind,
      targetId,
      targetTitle: title,
      creatorId: video.creatorId,
      creatorName: video.creatorName,
      defaultAmountInr: amountInr,
      minAmountInr: kind === 'membership' ? Math.max(29, amountInr) : Math.max(10, amountInr),
      maxAmountInr: 50000,
      allowCustomAmount: false,
    });
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
        {accessLockedReason ? (
          <div className="aspect-video w-full rounded-2xl overflow-hidden bg-zinc-950 border border-zinc-800 relative flex items-center justify-center p-6 text-center">
            <img
              src={video.thumbnailUrl}
              alt={video.title}
              className="absolute inset-0 w-full h-full object-cover opacity-20 blur-sm"
            />
            <div className="relative z-10 max-w-md space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-[#E11D48]/20 border border-[#E11D48]/40 text-[#F97316] flex items-center justify-center mx-auto">
                {accessLockedReason === 'paid' ? <Lock className="w-6 h-6" /> : <Crown className="w-6 h-6" />}
              </div>
              <div className="space-y-1.5">
                <div className="text-xs font-semibold uppercase tracking-wider text-[#F97316]">
                  {accessLockedReason === 'paid' ? 'Paid Creator Video' : 'Members-Only Exclusive'}
                </div>
                <h2 className="text-lg font-bold font-display text-white">
                  {accessLockedReason === 'paid'
                    ? `Unlock full access for ${formatInr(video.priceInr || 49)}`
                    : `Join ${video.creatorName} Channel Membership`}
                </h2>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  {accessLockedReason === 'paid'
                    ? 'Verified purchases unlock permanent streaming access with transparent creator revenue sharing.'
                    : 'Exclusive videos are unlocked automatically for verified active monthly members.'}
                </p>
              </div>

              {pendingQrAccess ? (
                <div className="p-3.5 rounded-xl bg-amber-950/75 border border-amber-500/40 text-xs text-amber-100 space-y-2 text-left">
                  <div className="flex items-center gap-2 font-bold text-amber-300">
                    <Clock className="w-4 h-4 shrink-0" />
                    <span>Payment Pending Verification (UTR: {pendingQrAccess.utrNumber})</span>
                  </div>
                  <p className="text-[11px] text-zinc-200 leading-relaxed">
                    Your {pendingQrAccess.paymentMethod} payment of {formatInr(pendingQrAccess.amountInr)} has been submitted. Access unlocks automatically once approved in the CEO Dashboard.
                  </p>
                  <button
                    type="button"
                    onClick={() => onNavigate('payments')}
                    className="text-[11px] font-semibold text-[#F97316] hover:underline"
                  >
                    Track Status in Payment History →
                  </button>
                </div>
              ) : accessLockedReason === 'paid' ? (
                <button
                  type="button"
                  onClick={() =>
                    openQrCheckoutAccess('paid_video', video.id, `Unlock Video: ${video.title}`, video.priceInr || 49)
                  }
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#E11D48] to-[#F97316] hover:opacity-95 text-xs font-semibold text-white"
                >
                  {`Pay via PhonePe / UPI QR · ${formatInr(video.priceInr || 49)}`}
                </button>
              ) : (
                <div className="space-y-2">
                  {creatorPlans.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => onOpenChannel(video.creatorId)}
                      className="px-4 py-2 rounded-xl bg-[#F97316] text-xs font-semibold text-white"
                    >
                      View Creator Channel
                    </button>
                  ) : (
                    creatorPlans.map((plan) => (
                      <button
                        key={plan.id}
                        type="button"
                        onClick={() =>
                          openQrCheckoutAccess(
                            'membership',
                            plan.id,
                            `${video.creatorName} — ${plan.name}`,
                            plan.priceInr
                          )
                        }
                        className="w-full px-4 py-2.5 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-xs font-semibold text-white flex items-center justify-between"
                      >
                        <span>{plan.name} (UPI QR)</span>
                        <span className="font-mono">{formatInr(plan.priceInr)} / mo</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
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
        )}

        <div className="space-y-4">
          <h1 className="text-xl md:text-2xl font-bold font-display text-zinc-900 dark:text-white leading-snug">
            {video.title}
          </h1>

          {/* Creator & Action Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => onOpenChannel(video.creatorId)}
                className="w-11 h-11 rounded-full overflow-hidden border border-zinc-200 dark:border-zinc-700 shrink-0"
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
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-900 dark:text-white hover:text-[#EA580C] dark:hover:text-[#F97316] transition-colors"
                >
                  <span>{video.creatorName}</span>
                  {creatorProfile?.isVerified && (
                    <BadgeCheck className="w-4 h-4 text-[#EA580C] dark:text-[#F97316]" />
                  )}
                </button>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  {video.category} · {video.language}
                </div>
              </div>

              <button
                type="button"
                onClick={handleSubscribe}
                className={`ml-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
                  isSubscribed
                    ? 'bg-zinc-100 dark:bg-[#18181D] text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                    : 'bg-[#E11D48] hover:bg-[#BE123C] text-white'
                }`}
              >
                {isSubscribed ? 'Subscribed' : 'Subscribe'}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center rounded-xl bg-zinc-50 dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                <button
                  type="button"
                  onClick={() => handleReact('like')}
                  className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium transition-colors ${
                    reaction === 'like'
                      ? 'text-[#BE123C] dark:text-[#FB7185] bg-rose-50 dark:bg-rose-950/40'
                      : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  <ThumbsUp className="w-4 h-4" />
                  <span className="tabular-nums">{formatCount(video.likesCount)}</span>
                </button>
                <div className="w-px h-5 bg-zinc-200 dark:bg-zinc-800" />
                <button
                  type="button"
                  onClick={() => handleReact('dislike')}
                  aria-label="Dislike video"
                  className={`flex items-center gap-1 px-3 py-2 text-xs transition-colors ${
                    reaction === 'dislike'
                      ? 'text-[#EA580C] dark:text-[#FDBA74] bg-orange-50 dark:bg-orange-950/40'
                      : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
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
                    ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/50 text-[#BE123C] dark:text-[#FB7185]'
                    : 'bg-zinc-50 dark:bg-[#141418] hover:bg-zinc-100 dark:hover:bg-zinc-800 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300'
                }`}
              >
                {isWatchLater ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                <span>{isWatchLater ? 'In Watch Later' : 'Watch Later'}</span>
              </button>

              <button
                type="button"
                onClick={handleStartWatchParty}
                disabled={startingParty}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-950/50 border border-rose-200 dark:border-rose-900/50 text-xs font-semibold text-[#BE123C] dark:text-[#FB7185] transition-colors whitespace-nowrap"
              >
                <Tv className="w-4 h-4" />
                <span>{startingParty ? 'Creating...' : 'Watch Party'}</span>
              </button>

              <button
                type="button"
                onClick={openQrSupport}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-orange-50 dark:bg-orange-950/30 hover:bg-orange-100 dark:hover:bg-orange-950/50 border border-orange-200 dark:border-orange-800/50 text-xs font-semibold text-[#EA580C] dark:text-[#FDBA74] transition-colors whitespace-nowrap"
              >
                <HeartHandshake className="w-4 h-4" />
                <span>Support</span>
              </button>

              <button
                type="button"
                onClick={handleShare}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-50 dark:bg-[#141418] hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 transition-colors"
              >
                <Share2 className="w-4 h-4" />
                <span>Share</span>
              </button>

              <button
                type="button"
                onClick={() => (user ? setShowPlaylistModal(true) : requireLogin())}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-50 dark:bg-[#141418] hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 transition-colors"
              >
                <BookmarkPlus className="w-4 h-4" />
                <span>Playlist</span>
              </button>

              <button
                type="button"
                onClick={() => (user ? setShowReportModal(true) : requireLogin())}
                aria-label="Report video"
                className="p-2 rounded-xl bg-zinc-50 dark:bg-[#141418] hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
              >
                <Flag className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Chapters Bar */}
          {video.chapters && video.chapters.length > 0 && (
            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-900 dark:text-white">
                <ListVideo className="w-4 h-4 text-[#EA580C] dark:text-[#F97316]" />
                <span>Video Chapters</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {video.chapters.map((ch, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSeekOverride(ch.timeSeconds)}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-[#18181D] hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-800 dark:text-zinc-200 transition-colors"
                  >
                    <span className="font-mono text-[#EA580C] dark:text-[#F97316]">{formatDuration(ch.timeSeconds)}</span>
                    <span>{ch.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Description Box */}
          <div className="p-4 rounded-xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 tabular-nums">
              <span>{formatCount(video.viewsCount)} views</span>
              <span aria-hidden="true">·</span>
              <span>{formatRelativeDate(video.createdAt)}</span>
              <span aria-hidden="true">·</span>
              <span className="text-[#EA580C] dark:text-[#F97316] font-semibold">{video.language}</span>
            </div>
            <p className={`text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-line ${showDesc ? '' : 'line-clamp-2'}`}>
              {video.description || 'Published on BharatPlay.'}
            </p>
            {video.tags && video.tags.length > 0 && (
              <div className="text-xs text-zinc-500 dark:text-zinc-400 pt-1">
                {video.tags.map((t) => `#${t}`).join('  ')}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => setShowDesc((s) => !s)}
                className="text-xs font-semibold text-zinc-900 dark:text-white hover:text-[#EA580C] dark:hover:text-[#F97316]"
              >
                {showDesc ? 'Show less' : 'Show more'}
              </button>
              <button
                type="button"
                onClick={() => (user ? setShowDisputeModal(true) : requireLogin())}
                className="text-xs text-zinc-500 dark:text-zinc-400 hover:text-[#E11D48] inline-flex items-center gap-1"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Report Payment Issue</span>
              </button>
            </div>
          </div>

          {/* Creator Affiliate Recommendations */}
          {creatorAffiliates.length > 0 && (
            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-zinc-900 dark:text-white">Featured Gear & Affiliate Links</span>
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400">Tracked via BharatPlay Safe Redirect</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {creatorAffiliates.slice(0, 4).map((aff) => (
                  <a
                    key={aff.id}
                    href={`/api/r/${encodeURIComponent(aff.code)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-3 p-3 rounded-lg bg-white dark:bg-[#18181D] hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-zinc-900 dark:text-white truncate">{aff.productTitle}</div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                        {aff.merchantName} · Code: <span className="font-mono">{aff.code}</span>
                      </div>
                    </div>
                    <ExternalLink className="w-4 h-4 text-[#EA580C] dark:text-[#F97316] shrink-0" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Comments Section */}
        <section className="space-y-5 pt-2">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
            <h2 className="text-base font-bold font-display text-zinc-900 dark:text-white tabular-nums">
              {comments.length} Comments
            </h2>
          </div>

          <form onSubmit={(e) => handleAddComment(e, '')} className="flex gap-3">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder={user ? 'Add a comment to the conversation...' : 'Sign in to join the conversation'}
              className="flex-1 px-4 py-2.5 rounded-xl bg-white dark:bg-[#111115] border border-zinc-300 dark:border-zinc-700 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-[#E11D48]"
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
              <p className="text-sm text-zinc-500 dark:text-zinc-400 py-4">Be the first to comment on this video.</p>
            ) : (
              topComments.map((cmt) => (
                <div key={cmt.id} className="space-y-3 pb-4 border-b border-zinc-200 dark:border-zinc-800">
                  <div className="flex items-start gap-3">
                    <MediaImage
                      src={cmt.authorAvatar}
                      alt={cmt.authorName}
                      className="w-8 h-8 rounded-full object-cover shrink-0 border border-zinc-200 dark:border-zinc-700"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-semibold text-zinc-900 dark:text-white">{cmt.authorName}</span>
                        <span className="text-zinc-500 dark:text-zinc-400">{formatRelativeDate(cmt.createdAt)}</span>
                      </div>
                      <p className="text-sm text-zinc-700 dark:text-zinc-300 mt-1 leading-relaxed">{cmt.text}</p>
                      <button
                        type="button"
                        onClick={() => setReplyToId(replyToId === cmt.id ? '' : cmt.id)}
                        className="mt-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
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
                            className="flex-1 px-3 py-1.5 rounded-lg bg-white dark:bg-[#111115] border border-zinc-300 dark:border-zinc-700 text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-[#F97316]"
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
                        <div key={rep.id} className="mt-3 pl-4 border-l border-zinc-200 dark:border-zinc-800 flex items-start gap-2.5">
                          <MediaImage
                            src={rep.authorAvatar}
                            alt={rep.authorName}
                            className="w-6 h-6 rounded-full object-cover shrink-0 border border-zinc-200 dark:border-zinc-700"
                          />
                          <div>
                            <div className="flex items-center gap-2 text-xs">
                              <span className="font-semibold text-zinc-900 dark:text-white">{rep.authorName}</span>
                              <span className="text-zinc-500 dark:text-zinc-400">{formatRelativeDate(rep.createdAt)}</span>
                            </div>
                            <p className="text-xs text-zinc-700 dark:text-zinc-300 mt-0.5">{rep.text}</p>
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
        <h2 className="text-base font-bold font-display text-zinc-900 dark:text-white">Up Next</h2>
        <div className="space-y-3">
          {relatedVideos.map((rel) => (
            <button
              key={rel.id}
              type="button"
              onClick={() => onWatchVideo(rel)}
              className="w-full flex items-start gap-3 p-2 rounded-xl hover:bg-zinc-50 dark:hover:bg-[#141418] text-left transition-colors group"
            >
              <div className="w-40 aspect-video rounded-lg overflow-hidden shrink-0 bg-zinc-100 dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800">
                <MediaImage
                  src={rel.thumbnailUrl}
                  alt={rel.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-white line-clamp-2 leading-snug group-hover:text-[#EA580C] dark:group-hover:text-[#F97316]">
                  {rel.title}
                </h3>
                <div className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 truncate">{rel.creatorName}</div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 tabular-nums">
                  {formatCount(rel.viewsCount)} views · {rel.language}
                </div>
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* Save to Playlist Modal */}
      {showPlaylistModal && (
        <div className="fixed inset-0 z-50 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-4 shadow-2xl text-zinc-900 dark:text-white">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">Save to Playlist</h3>
              <button type="button" onClick={() => setShowPlaylistModal(false)} className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {playlists.length === 0 ? (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">You don’t have any playlists yet.</p>
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
                      className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-[#18181D] hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-900 dark:text-white"
                    >
                      <span className="truncate">{pl.title}</span>
                      {included && <Check className="w-4 h-4 text-[#EA580C] dark:text-[#F97316] shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>
            <form onSubmit={handleCreateAndSavePlaylist} className="flex gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
              <input
                type="text"
                value={newPlaylistTitle}
                onChange={(e) => setNewPlaylistTitle(e.target.value)}
                placeholder="New playlist name..."
                className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-xs text-zinc-900 dark:text-white"
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

      <UpiQrPaymentModal
        open={Boolean(qrCheckout)}
        request={qrCheckout}
        onClose={() => setQrCheckout(null)}
        onNavigate={onNavigate}
      />

      {/* Payment Dispute Modal */}
      {showDisputeModal && (
        <div className="fixed inset-0 z-50 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!user || !profile || disputeReason.trim().length < 5) return;
              await reportPaymentDispute({
                reporterId: user.uid,
                reporterName: profile.displayName,
                creatorId: video.creatorId,
                creatorName: video.creatorName,
                transactionId: disputeRef.trim() || video.id,
                amountInr: video.priceInr || 0,
                category: disputeCategory,
                reason: disputeReason,
              });
              setShowDisputeModal(false);
              setDisputeRef('');
              setDisputeReason('');
              showToast('Payment dispute filed for BharatPlay audit.', 'success');
            }}
            className="w-full max-w-md bg-white dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-4 shadow-2xl text-zinc-900 dark:text-white"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">Report Payment / Access Issue</h3>
              <button type="button" onClick={() => setShowDisputeModal(false)} className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <select
              value={disputeCategory}
              onChange={(e) => setDisputeCategory(e.target.value as any)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-xs text-zinc-900 dark:text-white"
            >
              <option value="undelivered">Paid Video / Membership Not Unlocked</option>
              <option value="unauthorized">Unauthorized Payment Charge</option>
            </select>
            <input
              type="text"
              value={disputeRef}
              onChange={(e) => setDisputeRef(e.target.value)}
              placeholder="Order / Transaction ID (optional)"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-xs font-mono text-zinc-900 dark:text-white"
            />
            <textarea
              rows={3}
              required
              minLength={5}
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              placeholder="Explain what happened..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-xs text-zinc-900 dark:text-white"
            />
            <button type="submit" className="w-full py-2.5 rounded-xl bg-[#E11D48] text-xs font-semibold text-white">
              Submit Payment Dispute
            </button>
          </form>
        </div>
      )}

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleReportSubmit}
            className="w-full max-w-md bg-white dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-4 shadow-2xl text-zinc-900 dark:text-white"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">Report Content</h3>
              <button type="button" onClick={() => setShowReportModal(false)} className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <textarea
              rows={3}
              required
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="Describe the policy or safety issue..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-sm text-zinc-900 dark:text-white"
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
