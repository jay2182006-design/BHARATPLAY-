import React, { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  Clock,
  Crown,
  Handshake,
  HeartHandshake,
  ListVideo,
  MessageSquare,
  Rocket,
  Smartphone,
  Video,
  X,
} from 'lucide-react';
import { MediaImage } from '../components/MediaImage';
import { VideoCard } from '../components/VideoCard';
import { UpiQrPaymentModal, type UpiQrPaymentRequest } from '../components/UpiQrPaymentModal';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import {
  sendCollaborationRequest,
  subscribePublicPlaylistsByCreator,
  toggleSubscribe,
  voteCommunityPoll,
} from '../lib/bharatplayService';
import {
  subscribeMembershipPlans,
  subscribeSupporterHistory,
  subscribeUserMemberships,
  subscribeUserPaymentTransactions,
} from '../lib/monetizationService';
import { formatCount, formatInr, formatRelativeDate } from '../lib/formatters';
import type {
  AppRoute,
  CollaborationRequest,
  CommunityPost,
  CreatorMembership,
  CreatorSupport,
  MembershipPlan,
  PaymentTransaction,
  Playlist,
  Subscription,
  UserPublicProfile,
  VideoItem,
  WatchLaterItem,
} from '../types/bharatplay';

interface ChannelProfilePageProps {
  channelId: string;
  creators: UserPublicProfile[];
  videos: VideoItem[];
  communityPosts: CommunityPost[];
  subscriptions: Subscription[];
  userPlaylists: Playlist[];
  acceptedCollaborations: CollaborationRequest[];
  watchLater: WatchLaterItem[];
  onWatchVideo: (video: VideoItem) => void;
  onToggleWatchLater: (video: VideoItem) => void;
  onOpenShort: (shortId: string) => void;
  onOpenChannel: (creatorId: string) => void;
  onNavigate: (route: AppRoute) => void;
}

export function ChannelProfilePage({
  channelId,
  creators,
  videos,
  communityPosts,
  subscriptions,
  userPlaylists,
  acceptedCollaborations,
  watchLater,
  onWatchVideo,
  onToggleWatchLater,
  onOpenShort,
  onOpenChannel,
  onNavigate,
}: ChannelProfilePageProps) {
  const { user, profile, isCeo } = useAuth();
  const { showToast } = useToast();
  const [tab, setTab] = useState<'videos' | 'shorts' | 'memberships' | 'playlists' | 'community' | 'collabs' | 'about'>('videos');
  const [publicPlaylists, setPublicPlaylists] = useState<Playlist[]>([]);
  const [membershipPlans, setMembershipPlans] = useState<MembershipPlan[]>([]);
  const [myMemberships, setMyMemberships] = useState<CreatorMembership[]>([]);
  const [mySupports, setMySupports] = useState<CreatorSupport[]>([]);
  const [myPayments, setMyPayments] = useState<PaymentTransaction[]>([]);
  const [qrCheckout, setQrCheckout] = useState<UpiQrPaymentRequest | null>(null);

  // Collaboration Invite Modal
  const [showCollabModal, setShowCollabModal] = useState(false);
  const [collabTitle, setCollabTitle] = useState('');
  const [collabProposal, setCollabProposal] = useState('');
  const [sendingCollab, setSendingCollab] = useState(false);

  const channel = useMemo(() => {
    if (profile && profile.uid === channelId) return profile;
    return creators.find((c) => c.uid === channelId) || null;
  }, [creators, channelId, profile]);

  const isOwnChannel = Boolean(user && user.uid === channelId);
  const isSubscribed = subscriptions.some((s) => s.creatorId === channelId);
  const watchLaterSet = useMemo(() => new Set(watchLater.map((w) => w.videoId)), [watchLater]);

  useEffect(() => {
    if (!channelId) {
      setPublicPlaylists([]);
      setMembershipPlans([]);
      return;
    }
    const unsub1 = subscribePublicPlaylistsByCreator(channelId, setPublicPlaylists);
    const unsub2 = subscribeMembershipPlans(channelId, false, setMembershipPlans);
    return () => {
      unsub1();
      unsub2();
    };
  }, [channelId]);

  useEffect(() => {
    if (!user?.uid) {
      setMyMemberships([]);
      setMySupports([]);
      setMyPayments([]);
      return;
    }
    const u1 = subscribeUserMemberships(user.uid, setMyMemberships);
    const u2 = subscribeSupporterHistory(user.uid, setMySupports);
    const u3 = subscribeUserPaymentTransactions(user.uid, setMyPayments);
    return () => {
      u1();
      u2();
      u3();
    };
  }, [user?.uid]);

  const channelVideos = useMemo(
    () => videos.filter((v) => v.creatorId === channelId && v.type === 'video'),
    [videos, channelId]
  );
  const channelShorts = useMemo(
    () => videos.filter((v) => v.creatorId === channelId && v.type === 'short'),
    [videos, channelId]
  );
  const channelPosts = useMemo(
    () => communityPosts.filter((p) => p.creatorId === channelId),
    [communityPosts, channelId]
  );
  const channelCollabs = useMemo(
    () =>
      acceptedCollaborations.filter(
        (c) => c.senderId === channelId || c.recipientId === channelId
      ),
    [acceptedCollaborations, channelId]
  );

  const playlistsToShow = isOwnChannel ? userPlaylists : publicPlaylists;

  if (!channel) {
    return (
      <div className="max-w-3xl mx-auto p-12 text-center space-y-3">
        <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Channel not found</h1>
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className="px-4 py-2 rounded-xl bg-[#E11D48] text-xs font-semibold text-white"
        >
          Back to Home
        </button>
      </div>
    );
  }

  const isRestrictedChannel =
    channel.accountStatus === 'suspended' ||
    channel.accountStatus === 'deleted' ||
    channel.channelStatus === 'suspended' ||
    channel.channelStatus === 'deleted';

  if (isRestrictedChannel && !isOwnChannel && !isCeo) {
    return (
      <div className="max-w-3xl mx-auto p-12 text-center space-y-3">
        <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Channel Unavailable</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          This channel is currently unavailable due to a platform moderation action.
        </p>
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className="px-4 py-2 rounded-xl bg-[#E11D48] text-xs font-semibold text-white"
        >
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-[1440px] mx-auto pb-12">
      {/* Channel Banner */}
      <div className="h-40 md:h-56 w-full bg-zinc-100 dark:bg-[#141418] relative overflow-hidden">
        <MediaImage
          src={channel.bannerUrl || '/src/assets/images/thumb_himalayas_vlog_1794912702886.jpg'}
          alt={`${channel.displayName} banner`}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/15 to-transparent" />
      </div>

      <div className="px-4 md:px-8 -mt-12 relative z-10 space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="flex items-end gap-4">
            <MediaImage
              src={channel.avatarUrl}
              alt={channel.displayName}
              className="w-24 h-24 md:w-28 md:h-28 rounded-full object-cover border-4 border-white dark:border-[#09090B] bg-zinc-100 dark:bg-[#141418] shadow-lg"
            />
            <div className="pb-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl md:text-3xl font-bold font-display text-zinc-900 dark:text-white">
                  {channel.displayName}
                </h1>
                {channel.isVerified && (
                  <BadgeCheck className="w-5 h-5 text-[#EA580C] dark:text-[#F97316]" aria-label="Verified Creator" />
                )}
                {(channel.boostEnabled || channel.isEarlyCreator) && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800/50 text-[11px] font-semibold text-[#EA580C] dark:text-[#FDBA74]">
                    <Rocket className="w-3 h-3" />
                    Rising Creator
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-2 text-xs text-zinc-500 dark:text-zinc-400">
                <span>@{channel.handle}</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">{formatCount(channel.subscribersCount)} subscribers</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">{channelVideos.length + channelShorts.length} uploads</span>
                <span aria-hidden="true">·</span>
                <span className="text-[#EA580C] dark:text-[#F97316] font-semibold">{channel.preferredLanguage || 'Hindi'}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {isOwnChannel ? (
              <>
                <button
                  type="button"
                  onClick={() => onNavigate('studio')}
                  className="px-4 py-2.5 rounded-xl bg-[#E11D48] hover:bg-[#BE123C] text-xs font-semibold text-white"
                >
                  Open Creator Studio
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('settings')}
                  className="px-4 py-2.5 rounded-xl bg-zinc-100 dark:bg-[#141418] hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-900 dark:text-white"
                >
                  Edit Profile
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={async () => {
                    if (!user || !profile) return onNavigate('login');
                    const next = await toggleSubscribe(profile, channel, isSubscribed);
                    showToast(next ? `Subscribed to ${channel.displayName}` : 'Unsubscribed', 'success');
                  }}
                  className={`px-5 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                    isSubscribed
                      ? 'bg-zinc-100 dark:bg-[#18181D] text-zinc-900 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                      : 'bg-[#E11D48] hover:bg-[#BE123C] text-white'
                  }`}
                >
                  {isSubscribed ? 'Subscribed' : 'Subscribe'}
                </button>
                <button
                  type="button"
                  onClick={() => (user ? setShowCollabModal(true) : onNavigate('login'))}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-zinc-100 dark:bg-[#141418] hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-900 dark:text-white"
                >
                  <Handshake className="w-4 h-4 text-[#EA580C] dark:text-[#F97316]" />
                  <span>Collaborate</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!user) return onNavigate('login');
                    setQrCheckout({
                      serviceType: 'support',
                      targetId: channel.uid,
                      targetTitle: `Support ${channel.displayName}`,
                      creatorId: channel.uid,
                      creatorName: channel.displayName,
                      defaultAmountInr: 100,
                      minAmountInr: 10,
                      maxAmountInr: 50000,
                      allowCustomAmount: true,
                    });
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-orange-50 dark:bg-orange-950/30 hover:bg-orange-100 dark:hover:bg-orange-950/50 border border-orange-200 dark:border-orange-800/50 text-xs font-semibold text-[#EA580C] dark:text-[#FDBA74]"
                >
                  <HeartHandshake className="w-4 h-4" />
                  <span>Support</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Channel Tabs */}
        <div className="flex items-center gap-6 border-b border-zinc-200 dark:border-zinc-800 overflow-x-auto no-scrollbar">
          {[
            { id: 'videos', label: 'Videos', icon: <Video className="w-4 h-4" /> },
            { id: 'shorts', label: 'Shorts', icon: <Smartphone className="w-4 h-4" /> },
            { id: 'memberships', label: `Memberships (${membershipPlans.length})`, icon: <Crown className="w-4 h-4" /> },
            { id: 'playlists', label: 'Playlists', icon: <ListVideo className="w-4 h-4" /> },
            { id: 'community', label: 'Community', icon: <MessageSquare className="w-4 h-4" /> },
            { id: 'collabs', label: `Collaborations (${channelCollabs.length})`, icon: <Handshake className="w-4 h-4" /> },
            { id: 'about', label: 'About', icon: null },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id as any)}
              className={`flex items-center gap-2 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                tab === t.id
                  ? 'border-[#E11D48] text-zinc-900 dark:text-white font-semibold'
                  : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {tab === 'videos' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {channelVideos.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400 col-span-full py-8">No videos uploaded yet.</p>
            ) : (
              channelVideos.map((v) => (
                <VideoCard
                  key={v.id}
                  video={v}
                  onWatch={onWatchVideo}
                  onOpenChannel={() => {}}
                  creatorVerified={channel.isVerified}
                  isWatchLater={watchLaterSet.has(v.id)}
                  onToggleWatchLater={onToggleWatchLater}
                />
              ))
            )}
          </div>
        )}

        {tab === 'shorts' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {channelShorts.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400 col-span-full py-8">No Bharat Shorts uploaded yet.</p>
            ) : (
              channelShorts.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onOpenShort(s.id)}
                  className="relative aspect-[9/16] rounded-xl overflow-hidden bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-left"
                >
                  <MediaImage src={s.thumbnailUrl} alt={s.title} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3 text-xs font-semibold text-white line-clamp-2">
                    {s.title}
                  </div>
                </button>
              ))
            )}
          </div>
        )}

        {tab === 'memberships' && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-700 dark:text-zinc-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span>
                Pay via <strong>PhonePe, Google Pay, Paytm, or any UPI app</strong>. Memberships activate once your UTR is verified in the CEO Dashboard.
              </span>
              {user && (
                <button
                  type="button"
                  onClick={() => onNavigate('payments')}
                  className="text-xs font-semibold text-[#EA580C] dark:text-[#F97316] hover:underline shrink-0"
                >
                  View Payment History →
                </button>
              )}
            </div>
            {membershipPlans.length === 0 ? (
              <div className="p-8 rounded-xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 text-sm text-zinc-600 dark:text-zinc-400 text-center">
                {channel.displayName} hasn’t launched monthly membership tiers yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {membershipPlans.map((plan) => {
                  const active = myMemberships.some(
                    (m) => m.planId === plan.id && m.status === 'active' && m.paymentVerified
                  );
                  const pendingPlan = myPayments.find(
                    (p) =>
                      p.serviceType === 'membership' &&
                      p.targetId === plan.id &&
                      p.status === 'pending_verification'
                  );
                  return (
                    <div key={plan.id} className="p-5 rounded-xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-[#EA580C] dark:text-[#F97316]">Tier {plan.tierLevel}</span>
                          <span className="text-base font-bold font-mono tabular-nums text-zinc-900 dark:text-white">
                            {formatInr(plan.priceInr)}/mo
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-zinc-900 dark:text-white">{plan.name}</h3>
                        <p className="text-xs text-zinc-600 dark:text-zinc-400 whitespace-pre-line leading-relaxed">{plan.perks}</p>
                        {pendingPlan && (
                          <div className="text-[11px] font-mono text-amber-700 dark:text-amber-300 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 shrink-0" />
                            <span>Pending UTR {pendingPlan.utrNumber}</span>
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        disabled={active}
                        onClick={() => {
                          if (!user) return onNavigate('login');
                          setQrCheckout({
                            serviceType: 'membership',
                            targetId: plan.id,
                            targetTitle: `${channel.displayName} — ${plan.name}`,
                            creatorId: channel.uid,
                            creatorName: channel.displayName,
                            defaultAmountInr: plan.priceInr,
                            minAmountInr: Math.max(29, plan.priceInr),
                            allowCustomAmount: false,
                          });
                        }}
                        className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#E11D48] to-[#F97316] hover:opacity-95 disabled:opacity-50 text-xs font-semibold text-white"
                      >
                        {active
                          ? 'Active Member'
                          : pendingPlan
                          ? 'Submit Another UTR'
                          : `Join via UPI QR · ${formatInr(plan.priceInr)}/mo`}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Viewer's Support History to this creator */}
            {user && mySupports.filter((s) => s.creatorId === channel.uid).length > 0 && (
              <div className="p-5 rounded-xl bg-white dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 space-y-3">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Your Support History with {channel.displayName}</h3>
                <div className="divide-y divide-zinc-200 dark:divide-zinc-800 text-xs">
                  {mySupports
                    .filter((s) => s.creatorId === channel.uid)
                    .map((s) => (
                      <div key={s.id} className="py-2 flex items-center justify-between gap-4">
                        <div>
                          <span className="font-mono font-semibold text-zinc-900 dark:text-white">{formatInr(s.amountInr)}</span>
                          <span className="text-zinc-500 dark:text-zinc-400 ml-2">{s.message || 'Direct channel support'}</span>
                        </div>
                        <span className="text-[11px] font-mono uppercase text-zinc-600 dark:text-zinc-400">
                          {s.status || (s.paymentVerified ? 'verified' : 'pending')}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'playlists' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {playlistsToShow.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400 col-span-full py-8">No playlists created yet.</p>
            ) : (
              playlistsToShow.map((pl) => (
                <div key={pl.id} className="p-4 rounded-xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 space-y-3">
                  <div className="aspect-video rounded-lg overflow-hidden bg-zinc-100 dark:bg-[#18181D]">
                    <MediaImage src={pl.thumbnailUrl} alt={pl.title} className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-zinc-900 dark:text-white">{pl.title}</div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 tabular-nums">
                      {pl.videoIds.length} videos · {pl.visibility}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'community' && (
          <div className="max-w-2xl space-y-4">
            {channelPosts.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400 py-8">No community posts yet.</p>
            ) : (
              channelPosts.map((post) => (
                <div key={post.id} className="p-5 rounded-xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 space-y-3">
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    {post.postType} · {formatRelativeDate(post.createdAt)}
                  </div>
                  <p className="text-sm text-zinc-800 dark:text-zinc-200">{post.content}</p>
                  {post.postType === 'poll' && post.pollOptions && (
                    <div className="space-y-2">
                      {post.pollOptions.map((opt, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => voteCommunityPoll(post, idx)}
                          className="w-full text-left px-3 py-2 rounded-lg bg-white dark:bg-[#18181D] hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-white flex justify-between"
                        >
                          <span>{opt}</span>
                          <span className="font-mono tabular-nums text-zinc-500 dark:text-zinc-400">
                            {post.pollVotes?.[idx] || 0} votes
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'collabs' && (
          <div className="space-y-4">
            {channelCollabs.length === 0 ? (
              <div className="p-8 rounded-xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 text-center space-y-2">
                <p className="text-sm text-zinc-700 dark:text-zinc-300">No accepted creator collaborations displayed yet.</p>
                {!isOwnChannel && (
                  <button
                    type="button"
                    onClick={() => (user ? setShowCollabModal(true) : onNavigate('login'))}
                    className="px-4 py-2 rounded-xl bg-[#F97316] text-xs font-semibold text-white"
                  >
                    Send Collaboration Invite
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {channelCollabs.map((c) => {
                  const partnerId = c.senderId === channelId ? c.recipientId : c.senderId;
                  const partnerName = c.senderId === channelId ? c.recipientName : c.senderName;
                  const partnerAvatar = c.senderId === channelId ? c.recipientAvatar : c.senderAvatar;
                  return (
                    <div key={c.id} className="p-4 rounded-xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 flex items-start gap-3.5">
                      <button type="button" onClick={() => onOpenChannel(partnerId)}>
                        <MediaImage src={partnerAvatar} alt={partnerName} className="w-11 h-11 rounded-full object-cover border border-zinc-200 dark:border-zinc-700" />
                      </button>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="text-sm font-bold text-zinc-900 dark:text-white">{c.title}</div>
                        <button
                          type="button"
                          onClick={() => onOpenChannel(partnerId)}
                          className="text-xs text-[#EA580C] dark:text-[#F97316] hover:underline font-medium"
                        >
                          with {partnerName}
                        </button>
                        <p className="text-xs text-zinc-600 dark:text-zinc-400">{c.proposal}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === 'about' && (
          <div className="max-w-2xl p-6 rounded-xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 space-y-4">
            <h2 className="text-base font-bold text-zinc-900 dark:text-white">About {channel.displayName}</h2>
            <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
              {channel.bio || 'Creator on BharatPlay.'}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t border-zinc-200 dark:border-zinc-800 text-xs">
              <div>
                <div className="text-zinc-500 dark:text-zinc-400">Total Views</div>
                <div className="text-base font-bold font-mono tabular-nums text-zinc-900 dark:text-white mt-0.5">
                  {formatCount(channel.totalViews)}
                </div>
              </div>
              <div>
                <div className="text-zinc-500 dark:text-zinc-400">Primary Language</div>
                <div className="text-base font-bold text-zinc-900 dark:text-white mt-0.5">
                  {channel.preferredLanguage || 'Hindi'}
                </div>
              </div>
              <div>
                <div className="text-zinc-500 dark:text-zinc-400">BharatPlay Tier</div>
                <div className="text-base font-bold text-[#EA580C] dark:text-[#F97316] mt-0.5">
                  {channel.rewardTier || 'Seed'}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <UpiQrPaymentModal
        open={Boolean(qrCheckout)}
        request={qrCheckout}
        onClose={() => setQrCheckout(null)}
        onNavigate={onNavigate}
      />

      {/* Collaboration Request Modal */}
      {showCollabModal && (
        <div className="fixed inset-0 z-50 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!profile || !collabTitle.trim() || !collabProposal.trim()) return;
              setSendingCollab(true);
              try {
                await sendCollaborationRequest({
                  sender: profile,
                  recipient: channel,
                  title: collabTitle,
                  proposal: collabProposal,
                });
                setShowCollabModal(false);
                setCollabTitle('');
                setCollabProposal('');
                showToast(`Collaboration request sent to ${channel.displayName}!`, 'success');
              } catch {
                showToast('Could not send collaboration request.', 'error');
              } finally {
                setSendingCollab(false);
              }
            }}
            className="w-full max-w-md bg-white dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-2xl p-6 space-y-4 text-zinc-900 dark:text-white"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold flex items-center gap-2">
                <Handshake className="w-4 h-4 text-[#EA580C] dark:text-[#F97316]" />
                <span>Collaborate with {channel.displayName}</span>
              </h3>
              <button type="button" onClick={() => setShowCollabModal(false)} className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <input
              type="text"
              required
              maxLength={120}
              value={collabTitle}
              onChange={(e) => setCollabTitle(e.target.value)}
              placeholder="Project title (e.g., Joint Hindi/Telugu Tech Podcast)"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500"
            />
            <textarea
              rows={3}
              required
              maxLength={800}
              value={collabProposal}
              onChange={(e) => setCollabProposal(e.target.value)}
              placeholder="Describe your video concept, timeline, and co-production idea..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowCollabModal(false)} className="px-4 py-2 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white">
                Cancel
              </button>
              <button
                type="submit"
                disabled={sendingCollab}
                className="px-4 py-2 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-xs font-semibold text-white"
              >
                {sendingCollab ? 'Sending...' : 'Send Invite'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
