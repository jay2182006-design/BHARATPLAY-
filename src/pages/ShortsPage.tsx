import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Music2,
  Plus,
  Share2,
  ThumbsUp,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { MediaImage } from '../components/MediaImage';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import {
  addVideoComment,
  recordVideoShare,
  recordVideoView,
  subscribeVideoComments,
  toggleSubscribe,
  toggleVideoReaction,
} from '../lib/bharatplayService';
import { formatCount } from '../lib/formatters';
import type { AppRoute, Subscription, VideoComment, VideoItem } from '../types/bharatplay';

interface ShortsPageProps {
  shorts: VideoItem[];
  initialShortId?: string;
  subscriptions: Subscription[];
  onOpenUploadShort: () => void;
  onOpenChannel: (creatorId: string) => void;
  onNavigate: (route: AppRoute) => void;
}

export function ShortsPage({
  shorts,
  initialShortId,
  subscriptions,
  onOpenUploadShort,
  onOpenChannel,
  onNavigate,
}: ShortsPageProps) {
  const { user, profile } = useAuth();
  const { showToast } = useToast();

  const initialIdx = useMemo(() => {
    if (!initialShortId) return 0;
    const found = shorts.findIndex((s) => s.id === initialShortId);
    return found >= 0 ? found : 0;
  }, [initialShortId, shorts]);

  const [activeIdx, setActiveIdx] = useState(initialIdx);
  const [muted, setMuted] = useState(true);
  const [likedIds, setLikedIds] = useState<Record<string, boolean>>({});
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<VideoComment[]>([]);
  const [commentText, setCommentText] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const touchStartY = useRef<number | null>(null);

  const currentShort = shorts.length > 0 ? shorts[activeIdx % shorts.length] : null;

  useEffect(() => {
    setActiveIdx(initialIdx);
  }, [initialIdx]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !currentShort) return;
    v.load();
    v.play().catch(() => {});
    if (user?.uid) {
      recordVideoView(currentShort.id, currentShort.creatorId);
    }
  }, [currentShort?.id, user?.uid]);

  useEffect(() => {
    if (!commentsOpen || !currentShort) return;
    const unsub = subscribeVideoComments(currentShort.id, setComments);
    return () => unsub();
  }, [commentsOpen, currentShort?.id]);

  const goNext = () => {
    if (shorts.length === 0) return;
    setActiveIdx((i) => (i + 1) % shorts.length);
  };

  const goPrev = () => {
    if (shorts.length === 0) return;
    setActiveIdx((i) => (i - 1 + shorts.length) % shorts.length);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        goPrev();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shorts.length]);

  if (!currentShort) {
    return (
      <div className="p-12 text-center space-y-4">
        <p className="text-zinc-600">No Bharat Shorts published yet.</p>
        <button
          type="button"
          onClick={onOpenUploadShort}
          className="px-4 py-2 rounded-xl bg-[#E11D48] text-sm font-semibold text-white"
        >
          Upload First Bharat Short
        </button>
      </div>
    );
  }

  const isSubscribed = subscriptions.some((s) => s.creatorId === currentShort.creatorId);
  const isLiked = Boolean(likedIds[currentShort.id]);

  const handleLike = async () => {
    if (!user || !profile) {
      showToast('Sign in to like Bharat Shorts.', 'info');
      onNavigate('login');
      return;
    }
    const prev = isLiked ? 'like' : null;
    const next = await toggleVideoReaction(currentShort.id, user.uid, 'like', prev, {
      creatorId: currentShort.creatorId,
      actorName: profile.displayName,
      videoTitle: currentShort.title,
    });
    setLikedIds((m) => ({ ...m, [currentShort.id]: next === 'like' }));
  };

  const handleFollow = async () => {
    if (!user || !profile) {
      showToast('Sign in to follow creators.', 'info');
      onNavigate('login');
      return;
    }
    const next = await toggleSubscribe(
      profile,
      {
        uid: currentShort.creatorId,
        displayName: currentShort.creatorName,
        avatarUrl: currentShort.creatorAvatar,
      },
      isSubscribed
    );
    showToast(next ? `Following ${currentShort.creatorName}` : 'Unfollowed', 'success');
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) {
      onNavigate('login');
      return;
    }
    if (!commentText.trim()) return;
    await addVideoComment(currentShort.id, profile, commentText, '', {
      creatorId: currentShort.creatorId,
      videoTitle: currentShort.title,
    });
    setCommentText('');
  };

  return (
    <div
      className="relative h-[calc(100vh-8rem)] md:h-[calc(100vh-4.5rem)] flex items-center justify-center px-3 py-4 overflow-hidden select-none"
      onTouchStart={(e) => {
        touchStartY.current = e.touches[0].clientY;
      }}
      onTouchEnd={(e) => {
        if (touchStartY.current === null) return;
        const delta = touchStartY.current - e.changedTouches[0].clientY;
        if (delta > 50) goNext();
        else if (delta < -50) goPrev();
        touchStartY.current = null;
      }}
    >
      {/* Top Upload Short Trigger */}
      <button
        type="button"
        onClick={onOpenUploadShort}
        className="absolute top-4 right-4 z-20 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-zinc-50 border border-zinc-200 text-xs font-semibold text-zinc-900 shadow-md"
      >
        <Plus className="w-4 h-4 text-[#EA580C]" />
        <span>Upload Short</span>
      </button>

      {/* Vertical 9:16 Viewport */}
      <div className="relative h-full max-h-[760px] aspect-[9/16] bg-black rounded-2xl overflow-hidden border border-zinc-200 shadow-2xl flex items-center justify-center">
        <video
          ref={videoRef}
          src={currentShort.videoUrl}
          poster={currentShort.thumbnailUrl}
          muted={muted}
          loop
          playsInline
          autoPlay
          onClick={() => {
            const v = videoRef.current;
            if (!v) return;
            if (v.paused) v.play().catch(() => {});
            else v.pause();
          }}
          className="w-full h-full object-cover cursor-pointer"
        />

        <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/90 via-transparent to-black/30" />

        {/* Mute Toggle */}
        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? 'Unmute short' : 'Mute short'}
          className="absolute top-4 left-4 p-2.5 rounded-full bg-black/60 text-white hover:bg-black/80"
        >
          {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>

        {/* Bottom Info & Music Attribution */}
        <div className="absolute bottom-4 left-4 right-16 space-y-2.5">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => onOpenChannel(currentShort.creatorId)}
              className="w-9 h-9 rounded-full overflow-hidden border border-white/25 shrink-0"
            >
              <MediaImage
                src={currentShort.creatorAvatar}
                alt={currentShort.creatorName}
                className="w-full h-full object-cover"
              />
            </button>
            <button
              type="button"
              onClick={() => onOpenChannel(currentShort.creatorId)}
              className="text-sm font-semibold text-white hover:underline truncate"
            >
              {currentShort.creatorName}
            </button>
            <button
              type="button"
              onClick={handleFollow}
              className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                isSubscribed ? 'bg-white/15 text-white' : 'bg-[#E11D48] text-white'
              }`}
            >
              {isSubscribed ? 'Following' : 'Follow'}
            </button>
          </div>

          <p className="text-sm text-white font-medium line-clamp-2 leading-snug">
            {currentShort.title}
          </p>

          <div className="flex items-center gap-1.5 text-xs text-zinc-300">
            <Music2 className="w-3.5 h-3.5 text-[#F97316] shrink-0" />
            <span className="truncate">
              {currentShort.musicTrack || 'Original Audio — BharatPlay Creator'}
            </span>
          </div>
        </div>

        {/* Right Action Rail */}
        <div className="absolute bottom-5 right-3 flex flex-col items-center gap-4">
          <button
            type="button"
            onClick={handleLike}
            className="flex flex-col items-center gap-1 text-white"
          >
            <span
              className={`w-11 h-11 rounded-full flex items-center justify-center ${
                isLiked ? 'bg-[#E11D48]' : 'bg-black/60 hover:bg-black/80'
              }`}
            >
              <ThumbsUp className="w-5 h-5" />
            </span>
            <span className="text-[11px] font-mono tabular-nums">
              {formatCount(currentShort.likesCount + (isLiked ? 1 : 0))}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setCommentsOpen(true)}
            className="flex flex-col items-center gap-1 text-white"
          >
            <span className="w-11 h-11 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center">
              <MessageSquare className="w-5 h-5" />
            </span>
            <span className="text-[11px] font-mono tabular-nums">
              {formatCount(currentShort.commentsCount)}
            </span>
          </button>

          <button
            type="button"
            onClick={async () => {
              recordVideoShare(currentShort.id);
              await navigator.clipboard?.writeText(`${window.location.origin}/?short=${currentShort.id}`);
              showToast('Short link copied.', 'success');
            }}
            className="flex flex-col items-center gap-1 text-white"
          >
            <span className="w-11 h-11 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center">
              <Share2 className="w-5 h-5" />
            </span>
            <span className="text-[11px]">Share</span>
          </button>
        </div>
      </div>

      {/* Desktop Swipe Up / Down Controls */}
      <div className="hidden md:flex flex-col gap-3 ml-5">
        <button
          type="button"
          onClick={goPrev}
          aria-label="Previous Short"
          className="w-11 h-11 rounded-full bg-white hover:bg-zinc-50 border border-zinc-200 flex items-center justify-center text-zinc-900 shadow-sm"
        >
          <ChevronUp className="w-5 h-5" />
        </button>
        <div className="text-center text-[11px] font-mono tabular-nums text-zinc-500">
          {(activeIdx % shorts.length) + 1}/{shorts.length}
        </div>
        <button
          type="button"
          onClick={goNext}
          aria-label="Next Short"
          className="w-11 h-11 rounded-full bg-white hover:bg-zinc-50 border border-zinc-200 flex items-center justify-center text-zinc-900 shadow-sm"
        >
          <ChevronDown className="w-5 h-5" />
        </button>
      </div>

      {/* Comments Drawer */}
      {commentsOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="w-full max-w-md bg-white border border-zinc-200 rounded-t-3xl md:rounded-2xl p-5 space-y-4 max-h-[75vh] flex flex-col shadow-2xl text-zinc-900">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-zinc-900">Comments ({comments.length})</h3>
              <button type="button" onClick={() => setCommentsOpen(false)} className="text-zinc-500 hover:text-zinc-900">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3">
              {comments.length === 0 ? (
                <p className="text-xs text-zinc-500 text-center py-6">No comments yet.</p>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="text-xs space-y-0.5">
                    <span className="font-semibold text-zinc-900">{c.authorName}</span>
                    <p className="text-zinc-700">{c.text}</p>
                  </div>
                ))
              )}
            </div>
            <form onSubmit={handleCommentSubmit} className="flex gap-2 pt-2 border-t border-zinc-200">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Write a comment..."
                className="flex-1 px-3 py-2 rounded-xl bg-white border border-zinc-300 text-xs text-zinc-900"
              />
              <button type="submit" className="px-3.5 py-2 rounded-xl bg-[#E11D48] text-xs font-semibold text-white">
                Send
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
