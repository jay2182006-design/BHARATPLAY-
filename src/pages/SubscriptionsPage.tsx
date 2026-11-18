import React, { useMemo } from 'react';
import { Users } from 'lucide-react';
import { VideoCard } from '../components/VideoCard';
import { MediaImage } from '../components/MediaImage';
import { useAuth } from '../contexts/AuthContext';
import type { AppRoute, Subscription, UserPublicProfile, VideoItem, WatchLaterItem } from '../types/bharatplay';

interface SubscriptionsPageProps {
  subscriptions: Subscription[];
  videos: VideoItem[];
  creators: UserPublicProfile[];
  watchLater: WatchLaterItem[];
  onWatchVideo: (video: VideoItem) => void;
  onToggleWatchLater: (video: VideoItem) => void;
  onOpenChannel: (creatorId: string) => void;
  onNavigate: (route: AppRoute) => void;
}

export function SubscriptionsPage({
  subscriptions,
  videos,
  creators,
  watchLater,
  onWatchVideo,
  onToggleWatchLater,
  onOpenChannel,
  onNavigate,
}: SubscriptionsPageProps) {
  const { user } = useAuth();

  const creatorVerifiedMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const c of creators) map[c.uid] = Boolean(c.isVerified);
    return map;
  }, [creators]);

  const watchLaterSet = useMemo(() => new Set(watchLater.map((w) => w.videoId)), [watchLater]);

  if (!user) {
    return (
      <div className="max-w-lg mx-auto my-16 p-8 rounded-2xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 text-center space-y-4">
        <Users className="w-10 h-10 text-[#E11D48] mx-auto" />
        <h1 className="text-xl font-bold font-display text-zinc-900 dark:text-white">Sign in for your Subscriptions</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Follow your favorite Indian creators and never miss their latest uploads or live streams.
        </p>
        <button
          type="button"
          onClick={() => onNavigate('login')}
          className="px-5 py-2.5 rounded-xl bg-[#E11D48] hover:bg-[#BE123C] text-sm font-semibold text-white transition-colors"
        >
          Sign In to BHARATPLAY
        </button>
      </div>
    );
  }

  const subIds = new Set(subscriptions.map((s) => s.creatorId));
  const feedVideos = videos.filter((v) => subIds.has(v.creatorId));

  return (
    <div className="max-w-[1440px] mx-auto px-4 md:px-6 lg:px-8 py-6 space-y-8">
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <h1 className="text-2xl font-bold font-display text-zinc-900 dark:text-white">Subscriptions</h1>
        <span className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">{subscriptions.length} channels</span>
      </div>

      {subscriptions.length === 0 ? (
        <div className="p-10 rounded-2xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 text-center space-y-4">
          <p className="text-sm text-zinc-700 dark:text-zinc-300">You haven’t subscribed to any creators yet.</p>
          <button
            type="button"
            onClick={() => onNavigate('explore')}
            className="px-4 py-2 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-xs font-semibold text-white transition-colors"
          >
            Discover Indian Creators
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-4 overflow-x-auto no-scrollbar pb-2">
            {subscriptions.map((sub) => (
              <button
                key={sub.id}
                type="button"
                onClick={() => onOpenChannel(sub.creatorId)}
                className="flex flex-col items-center gap-2 shrink-0 w-24 group"
              >
                <MediaImage
                  src={sub.creatorAvatar}
                  alt={sub.creatorName || 'Creator'}
                  className="w-14 h-14 rounded-full object-cover border-2 border-[#E11D48]/60 group-hover:border-[#F97316] transition-colors"
                />
                <span className="text-xs text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-white truncate w-full text-center font-medium">
                  {sub.creatorName || 'Creator'}
                </span>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {feedVideos.map((v) => (
              <VideoCard
                key={v.id}
                video={v}
                onWatch={onWatchVideo}
                onOpenChannel={onOpenChannel}
                creatorVerified={creatorVerifiedMap[v.creatorId]}
                isWatchLater={watchLaterSet.has(v.id)}
                onToggleWatchLater={onToggleWatchLater}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
