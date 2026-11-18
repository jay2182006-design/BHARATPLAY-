import React from 'react';
import { motion } from 'motion/react';
import { BadgeCheck, Bookmark, BookmarkCheck, Sparkles } from 'lucide-react';
import { formatCount, formatDuration, formatRelativeDate } from '../lib/formatters';
import type { VideoItem } from '../types/bharatplay';
import { MediaImage } from './MediaImage';

interface VideoCardProps {
  video: VideoItem;
  onWatch: (video: VideoItem) => void;
  onOpenChannel: (creatorId: string) => void;
  progressSeconds?: number;
  creatorVerified?: boolean;
  isWatchLater?: boolean;
  onToggleWatchLater?: (video: VideoItem) => void;
}

export function VideoCard({
  video,
  onWatch,
  onOpenChannel,
  progressSeconds,
  creatorVerified,
  isWatchLater,
  onToggleWatchLater,
}: VideoCardProps) {
  const duration = video.durationSeconds || 8;
  const pct =
    progressSeconds && duration > 0
      ? Math.min(100, Math.round((progressSeconds / duration) * 100))
      : 0;

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className="group flex flex-col gap-3"
    >
      <div className="relative">
        <button
          type="button"
          onClick={() => onWatch(video)}
          className="relative aspect-video w-full overflow-hidden rounded-xl bg-zinc-100 dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E11D48]"
        >
          <MediaImage
            src={video.thumbnailUrl}
            alt={video.title}
            fallbackLabel={video.title}
            className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/15 opacity-85" />

          {video.isOriginal && (
            <span className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gradient-to-r from-[#E11D48] to-[#F97316] text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
              <Sparkles className="w-2.5 h-2.5" />
              Original
            </span>
          )}

          {video.accessType === 'paid' && (
            <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/85 text-[11px] font-mono font-bold tabular-nums text-amber-300 border border-amber-400/30">
              Paid · ₹{video.priceInr || 49}
            </span>
          )}

          {video.accessType === 'members_only' && (
            <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/85 text-[11px] font-semibold text-orange-300 border border-orange-400/30">
              Members Only
            </span>
          )}

          <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-[11px] font-mono tabular-nums text-white border border-white/10">
            {formatDuration(duration)}
          </span>

          {pct > 0 && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
              <div className="h-full bg-[#E11D48]" style={{ width: `${pct}%` }} />
            </div>
          )}
        </button>

        {onToggleWatchLater && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleWatchLater(video);
            }}
            aria-label={isWatchLater ? 'Remove from Watch Later' : 'Save to Watch Later'}
            title={isWatchLater ? 'Saved to Watch Later' : 'Save to Watch Later'}
            className={`absolute top-2 right-2 p-1.5 rounded-lg border backdrop-blur-md transition-all ${
              isWatchLater
                ? 'bg-[#E11D48] border-[#E11D48] text-white opacity-100'
                : 'bg-black/70 border-white/15 text-white opacity-0 group-hover:opacity-100 hover:bg-black/90'
            }`}
          >
            {isWatchLater ? (
              <BookmarkCheck className="w-3.5 h-3.5" />
            ) : (
              <Bookmark className="w-3.5 h-3.5" />
            )}
          </button>
        )}
      </div>

      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => onOpenChannel(video.creatorId)}
          className="shrink-0 w-9 h-9 rounded-full overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-[#141418] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316]"
          aria-label={`View ${video.creatorName} channel`}
        >
          <MediaImage
            src={video.creatorAvatar}
            alt={video.creatorName}
            className="w-full h-full object-cover"
          />
        </button>

        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => onWatch(video)}
            className="text-left block w-full"
          >
            <h3 className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-50 leading-snug line-clamp-2 group-hover:text-[#E11D48] transition-colors">
              {video.title}
            </h3>
          </button>

          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            <button
              type="button"
              onClick={() => onOpenChannel(video.creatorId)}
              className="inline-flex items-center gap-1 hover:text-zinc-900 dark:hover:text-white transition-colors truncate max-w-[150px]"
            >
              <span className="truncate">{video.creatorName}</span>
              {creatorVerified && (
                <BadgeCheck className="w-3.5 h-3.5 text-[#EA580C] shrink-0" />
              )}
            </button>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{formatCount(video.viewsCount)} views</span>
            <span aria-hidden="true">·</span>
            <span>{formatRelativeDate(video.createdAt)}</span>
            <span aria-hidden="true">·</span>
            <span className="text-[#EA580C] font-medium">{video.language}</span>
          </div>
        </div>
      </div>
    </motion.article>
  );
}
