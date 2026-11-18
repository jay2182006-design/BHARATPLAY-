import React, { useMemo } from 'react';
import { Bookmark, History, Trash2 } from 'lucide-react';
import { VideoCard } from '../components/VideoCard';
import { MediaImage } from '../components/MediaImage';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import { removeWatchHistoryItem } from '../lib/bharatplayService';
import { formatDuration, formatRelativeDate } from '../lib/formatters';
import type {
  AppRoute,
  UserPublicProfile,
  VideoItem,
  WatchHistoryItem,
  WatchLaterItem,
} from '../types/bharatplay';

interface LibraryPageProps {
  mode: 'watch-later' | 'history';
  videos: VideoItem[];
  creators: UserPublicProfile[];
  watchLater: WatchLaterItem[];
  watchHistory: WatchHistoryItem[];
  onWatchVideo: (video: VideoItem) => void;
  onToggleWatchLater: (video: VideoItem) => void;
  onOpenChannel: (creatorId: string) => void;
  onNavigate: (route: AppRoute) => void;
}

export function LibraryPage({
  mode,
  videos,
  creators,
  watchLater,
  watchHistory,
  onWatchVideo,
  onToggleWatchLater,
  onOpenChannel,
  onNavigate,
}: LibraryPageProps) {
  const { user } = useAuth();
  const { showToast } = useToast();

  const creatorVerifiedMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const c of creators) map[c.uid] = Boolean(c.isVerified);
    return map;
  }, [creators]);

  const watchLaterSet = useMemo(() => new Set(watchLater.map((w) => w.videoId)), [watchLater]);

  if (!user) {
    return (
      <div className="max-w-lg mx-auto my-16 p-8 rounded-2xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 text-center space-y-4">
        {mode === 'watch-later' ? (
          <Bookmark className="w-10 h-10 text-[#EA580C] dark:text-[#F97316] mx-auto" />
        ) : (
          <History className="w-10 h-10 text-[#E11D48] mx-auto" />
        )}
        <h1 className="text-xl font-bold font-display text-zinc-900 dark:text-white">
          {mode === 'watch-later' ? 'Sign in for Watch Later' : 'Sign in for Watch History'}
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Your saved videos and playback progress sync securely across sessions.
        </p>
        <button
          type="button"
          onClick={() => onNavigate('login')}
          className="px-5 py-2.5 rounded-xl bg-[#E11D48] hover:bg-[#BE123C] text-sm font-semibold text-white"
        >
          Sign In to BHARATPLAY
        </button>
      </div>
    );
  }

  if (mode === 'watch-later') {
    const savedVideos = watchLater
      .map((item) => videos.find((v) => v.id === item.videoId))
      .filter((v): v is VideoItem => Boolean(v));

    return (
      <div className="max-w-[1440px] mx-auto px-4 md:px-6 lg:px-8 py-6 space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-4">
          <div className="flex items-center gap-2.5">
            <Bookmark className="w-5 h-5 text-[#EA580C] dark:text-[#F97316]" />
            <h1 className="text-2xl font-bold font-display text-zinc-900 dark:text-white">Watch Later</h1>
          </div>
          <span className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">{savedVideos.length} saved</span>
        </div>

        {savedVideos.length === 0 ? (
          <div className="p-12 rounded-2xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 text-center space-y-3">
            <p className="text-sm text-zinc-700 dark:text-zinc-300">Your Watch Later list is empty.</p>
            <button
              type="button"
              onClick={() => onNavigate('home')}
              className="px-4 py-2 rounded-xl bg-[#E11D48] text-xs font-semibold text-white"
            >
              Browse Videos
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {savedVideos.map((v) => (
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
        )}
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 space-y-6">
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div className="flex items-center gap-2.5">
          <History className="w-5 h-5 text-[#E11D48]" />
          <h1 className="text-2xl font-bold font-display text-zinc-900 dark:text-white">Watch History</h1>
        </div>
        <span className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">{watchHistory.length} videos</span>
      </div>

      {watchHistory.length === 0 ? (
        <div className="p-12 rounded-2xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 text-center space-y-3">
          <p className="text-sm text-zinc-700 dark:text-zinc-300">No watch history recorded yet.</p>
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="px-4 py-2 rounded-xl bg-[#F97316] text-xs font-semibold text-white"
          >
            Discover Videos
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {watchHistory.map((item) => {
            const videoMatch = videos.find((v) => v.id === item.videoId);
            const dur = item.durationSeconds || 8;
            const pct = Math.min(100, Math.round((item.progressSeconds / Math.max(1, dur)) * 100));
            return (
              <div
                key={item.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3.5 rounded-xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800"
              >
                <button
                  type="button"
                  onClick={() => {
                    if (videoMatch) onWatchVideo(videoMatch);
                  }}
                  className="flex items-center gap-4 text-left flex-1 min-w-0 group"
                >
                  <div className="relative w-40 aspect-video rounded-lg overflow-hidden bg-zinc-900 shrink-0 border border-zinc-200 dark:border-zinc-700">
                    <MediaImage src={item.thumbnailUrl} alt={item.title} className="w-full h-full object-cover" />
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/30">
                      <div className="h-full bg-[#E11D48]" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-zinc-900 dark:text-white group-hover:text-[#EA580C] dark:group-hover:text-[#F97316] truncate">
                      {item.title}
                    </div>
                    <div className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                      {item.creatorName || 'Creator'} · Watched {formatDuration(item.progressSeconds)} / {formatDuration(dur)}
                    </div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                      {formatRelativeDate(item.updatedAt)}
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    await removeWatchHistoryItem(user.uid, item.videoId);
                    showToast('Removed from Watch History.', 'info');
                  }}
                  className="p-2 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-[#E11D48] hover:bg-rose-50 dark:hover:bg-rose-950/30 self-end sm:self-center"
                  aria-label="Remove from history"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
