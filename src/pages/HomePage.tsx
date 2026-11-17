import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  BadgeCheck,
  ChevronRight,
  Clock,
  Compass,
  Flame,
  Globe2,
  Play,
  Radio,
  Rocket,
  Sparkles,
  TrendingUp,
  Trophy,
  Tv,
  Users,
} from 'lucide-react';
import { MediaImage } from '../components/MediaImage';
import { VideoCard } from '../components/VideoCard';
import { CreatorGridSkeleton, VideoGridSkeleton } from '../components/SkeletonCard';
import { formatCount } from '../lib/formatters';
import { DEFAULT_CATEGORIES, REGIONAL_SPOTLIGHT_LANGUAGES } from '../lib/catalogSeed';
import { computeCreatorPerformance, getVideoQualityScore } from '../lib/creatorMetrics';
import type {
  AppRoute,
  LiveStream,
  PlatformConfig,
  UserPublicProfile,
  VideoItem,
  WatchHistoryItem,
  WatchLaterItem,
} from '../types/bharatplay';

interface HomePageProps {
  videos: VideoItem[];
  creators: UserPublicProfile[];
  liveStreams: LiveStream[];
  watchHistory: WatchHistoryItem[];
  watchLater: WatchLaterItem[];
  platformConfig: PlatformConfig;
  preferredLanguage?: string;
  loading?: boolean;
  onWatchVideo: (video: VideoItem) => void;
  onToggleWatchLater: (video: VideoItem) => void;
  onOpenChannel: (creatorId: string) => void;
  onNavigate: (route: AppRoute, param?: string) => void;
}

export function HomePage({
  videos,
  creators,
  liveStreams,
  watchHistory,
  watchLater,
  platformConfig,
  preferredLanguage,
  loading = false,
  onWatchVideo,
  onToggleWatchLater,
  onOpenChannel,
  onNavigate,
}: HomePageProps) {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [spotlightLang, setSpotlightLang] = useState<string>(
    preferredLanguage && REGIONAL_SPOTLIGHT_LANGUAGES.includes(preferredLanguage as any)
      ? preferredLanguage
      : 'Hindi'
  );

  const creatorVerifiedMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const c of creators) map[c.uid] = Boolean(c.isVerified);
    return map;
  }, [creators]);

  const watchLaterSet = useMemo(() => new Set(watchLater.map((w) => w.videoId)), [watchLater]);

  const categories = useMemo(
    () => ['All', ...(platformConfig.categories?.length ? platformConfig.categories : DEFAULT_CATEGORIES.slice(1))],
    [platformConfig.categories]
  );

  const standardVideos = useMemo(
    () =>
      videos.filter((v) => {
        if (v.type !== 'video') return false;
        if (selectedCategory !== 'All' && v.category !== selectedCategory) return false;
        return true;
      }),
    [videos, selectedCategory]
  );

  const continueWatchingItems = useMemo(() => {
    return watchHistory
      .map((h) => {
        const vid = videos.find((v) => v.id === h.videoId);
        return vid ? { video: vid, progress: h.progressSeconds } : null;
      })
      .filter((x): x is { video: VideoItem; progress: number } => Boolean(x))
      .slice(0, 4);
  }, [watchHistory, videos]);

  const liveNowStreams = useMemo(() => liveStreams.filter((s) => s.isLive).slice(0, 4), [liveStreams]);

  const trendingInIndia = useMemo(() => {
    return [...standardVideos]
      .sort((a, b) => (Number(b.isTrending) - Number(a.isTrending)) || b.viewsCount - a.viewsCount)
      .slice(0, 4);
  }, [standardVideos]);

  const recommendedForYou = useMemo(() => {
    const watchedCats = new Set(
      watchHistory
        .map((h) => videos.find((v) => v.id === h.videoId)?.category)
        .filter(Boolean)
    );
    return [...standardVideos]
      .sort((a, b) => {
        const boostA =
          (preferredLanguage && a.language === preferredLanguage ? 30 : 0) +
          (watchedCats.has(a.category) ? 20 : 0) +
          getVideoQualityScore(a);
        const boostB =
          (preferredLanguage && b.language === preferredLanguage ? 30 : 0) +
          (watchedCats.has(b.category) ? 20 : 0) +
          getVideoQualityScore(b);
        return boostB - boostA;
      })
      .slice(0, 4);
  }, [standardVideos, preferredLanguage, watchHistory, videos]);

  const mostWatchedWeek = useMemo(() => {
    return [...standardVideos]
      .sort(
        (a, b) =>
          (b.totalWatchSeconds || b.viewsCount * 6) - (a.totalWatchSeconds || a.viewsCount * 6)
      )
      .slice(0, 4);
  }, [standardVideos]);

  const originals = useMemo(() => {
    const marked = standardVideos.filter((v) => v.isOriginal);
    return (marked.length > 0 ? marked : standardVideos).slice(0, 4);
  }, [standardVideos]);

  const regionalVideos = useMemo(() => {
    return videos.filter((v) => v.language === spotlightLang).slice(0, 4);
  }, [videos, spotlightLang]);

  const risingCreators = useMemo(() => {
    return creators
      .filter((c) => c.isCreator && (c.isEarlyCreator || c.boostEnabled))
      .map((c) => computeCreatorPerformance(c, videos))
      .sort((a, b) => b.boostScore - a.boostScore)
      .slice(0, 4);
  }, [creators, videos]);

  const newCreatorsToWatch = useMemo(() => {
    return creators
      .filter((c) => c.isCreator)
      .sort((a, b) => (a.subscribersCount || 0) - (b.subscribersCount || 0))
      .slice(0, 4);
  }, [creators]);

  const renderVideoGrid = (list: VideoItem[], emptyLabel: string, progressLookup?: Record<string, number>) => {
    if (loading && list.length === 0) return <VideoGridSkeleton count={4} />;
    if (list.length === 0) {
      return (
        <div className="p-8 rounded-2xl bg-zinc-50 border border-zinc-200 text-center space-y-2">
          <p className="text-sm font-medium text-zinc-700">{emptyLabel}</p>
          {selectedCategory !== 'All' && (
            <button
              type="button"
              onClick={() => setSelectedCategory('All')}
              className="px-4 py-1.5 rounded-lg bg-zinc-200 hover:bg-zinc-300 text-xs font-semibold text-zinc-900"
            >
              Reset Category Filter
            </button>
          )}
        </div>
      );
    }
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {list.map((v) => (
          <VideoCard
            key={v.id}
            video={v}
            onWatch={onWatchVideo}
            onOpenChannel={onOpenChannel}
            progressSeconds={progressLookup?.[v.id]}
            creatorVerified={creatorVerifiedMap[v.creatorId]}
            isWatchLater={watchLaterSet.has(v.id)}
            onToggleWatchLater={onToggleWatchLater}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="px-4 md:px-6 lg:px-8 py-6 space-y-10 max-w-[1440px] mx-auto">
      {/* Hero Banner */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-50 via-white to-orange-50/60 border border-zinc-200 p-6 md:p-9"
      >
        <div className="absolute -right-24 -top-24 w-72 h-72 rounded-full bg-[#E11D48]/10 blur-3xl pointer-events-none" />
        <div className="absolute -left-16 -bottom-24 w-64 h-64 rounded-full bg-[#F97316]/10 blur-3xl pointer-events-none" />

        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#EA580C]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>India Creates. India Watches.</span>
            </div>
            <h1 className="text-2xl md:text-4xl font-bold font-display text-zinc-900 leading-tight">
              Creator-First Indian Streaming, Live & Watch Parties
            </h1>
            <p className="text-sm md:text-base text-zinc-600 leading-relaxed">
              Discover independent creators across 8+ Indian languages, compete in the monthly Creator League, and watch synchronized streams with friends.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('boost')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#E11D48] to-[#F97316] hover:opacity-95 text-xs sm:text-sm font-semibold text-white transition-opacity shadow-sm"
            >
              <Rocket className="w-4 h-4" />
              <span>Creator Boost</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('league')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-zinc-100 border border-zinc-200 text-xs sm:text-sm font-semibold text-zinc-900 transition-colors"
            >
              <Trophy className="w-4 h-4 text-[#EA580C]" />
              <span>Creator League</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('watch-party')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-zinc-100 border border-zinc-200 text-xs sm:text-sm font-semibold text-zinc-900 transition-colors"
            >
              <Tv className="w-4 h-4 text-[#E11D48]" />
              <span>Watch Party</span>
            </button>
          </div>
        </div>
      </motion.section>

      {/* Category Filter Strip */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setSelectedCategory(cat)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap border transition-colors ${
              selectedCategory === cat
                ? 'bg-[#E11D48] border-[#E11D48] text-white'
                : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:border-zinc-300'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* 1. Continue Watching */}
      {continueWatchingItems.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-bold font-display text-zinc-900">
              <Clock className="w-5 h-5 text-[#EA580C]" />
              <span>Continue Watching</span>
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('history')}
              className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 inline-flex items-center gap-1"
            >
              <span>Watch History</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {renderVideoGrid(
            continueWatchingItems.map((i) => i.video),
            'No watch history yet.',
            Object.fromEntries(continueWatchingItems.map((i) => [i.video.id, i.progress]))
          )}
        </section>
      )}

      {/* 2. Live Now */}
      {liveNowStreams.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-bold font-display text-zinc-900">
              <Radio className="w-5 h-5 text-[#E11D48]" />
              <span>Live Now</span>
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('live')}
              className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 inline-flex items-center gap-1"
            >
              <span>All Streams</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {liveNowStreams.map((stream) => (
              <button
                key={stream.id}
                type="button"
                onClick={() => onNavigate('live', stream.id)}
                className="group text-left rounded-xl bg-white border border-zinc-200 hover:border-[#E11D48]/50 overflow-hidden transition-colors"
              >
                <div className="relative aspect-video">
                  <MediaImage
                    src={stream.thumbnailUrl}
                    alt={stream.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  <span className="absolute top-2 left-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#E11D48] text-[10px] font-bold text-white">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    LIVE
                  </span>
                  <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/75 text-[11px] font-mono text-white">
                    {formatCount(stream.viewerCount)} watching
                  </span>
                </div>
                <div className="p-3.5 space-y-1">
                  <div className="text-sm font-semibold text-zinc-900 line-clamp-1 group-hover:text-[#E11D48]">
                    {stream.title}
                  </div>
                  <div className="text-xs text-zinc-500 truncate">
                    {stream.creatorName} · {stream.language || 'Hindi'}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* 3. Trending in India */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold font-display text-zinc-900">
            <Flame className="w-5 h-5 text-[#E11D48]" />
            <span>Trending in India</span>
          </h2>
          <button
            type="button"
            onClick={() => onNavigate('explore')}
            className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 inline-flex items-center gap-1"
          >
            <span>Explore More</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
        {renderVideoGrid(trendingInIndia, `No trending videos in ${selectedCategory}.`)}
      </section>

      {/* 4. Recommended For You */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold font-display text-zinc-900">
              <Sparkles className="w-5 h-5 text-[#EA580C]" />
              <span>Recommended For You</span>
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Curated by viewer retention, language preferences{preferredLanguage ? ` (${preferredLanguage})` : ''}, and authentic engagement.
            </p>
          </div>
        </div>
        {renderVideoGrid(recommendedForYou, `No recommendations match ${selectedCategory}.`)}
      </section>

      {/* 5. Rising Indian Creators */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold font-display text-zinc-900">
              <Rocket className="w-5 h-5 text-[#EA580C]" />
              <span>Rising Indian Creators</span>
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Creator Boost Spotlight · Ranked transparently by real engagement and watch retention
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('boost')}
            className="text-xs font-semibold text-[#EA580C] hover:underline inline-flex items-center gap-1"
          >
            <span>Creator Boost Hub</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {loading && risingCreators.length === 0 ? (
          <CreatorGridSkeleton count={4} />
        ) : risingCreators.length === 0 ? (
          <div className="p-6 rounded-xl bg-zinc-50 border border-zinc-200 text-sm text-zinc-600">
            Rising creators will appear here as channels join the Boost program.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {risingCreators.map(({ creator, engagementRatePct, retentionPct }) => (
              <button
                key={creator.uid}
                type="button"
                onClick={() => onOpenChannel(creator.uid)}
                className="flex items-start gap-3.5 p-4 rounded-xl bg-white hover:bg-zinc-50 border border-zinc-200 hover:border-[#F97316]/50 text-left transition-colors"
              >
                <MediaImage
                  src={creator.avatarUrl}
                  alt={creator.displayName}
                  className="w-12 h-12 rounded-full object-cover shrink-0 border border-zinc-200"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-zinc-900 truncate">
                      {creator.displayName}
                    </span>
                    {creator.isVerified && (
                      <BadgeCheck className="w-4 h-4 text-[#EA580C] shrink-0" />
                    )}
                  </div>
                  <div className="text-xs text-zinc-500 mt-0.5 tabular-nums">
                    {formatCount(creator.subscribersCount)} subs · {creator.preferredLanguage || 'Hindi'}
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-[11px] font-medium">
                    <span className="px-2 py-0.5 rounded bg-orange-50 text-[#EA580C]">
                      Rising Creator
                    </span>
                    <span className="text-zinc-500 tabular-nums">
                      {retentionPct}% ret · {engagementRatePct}% eng
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* 6. Most Watched This Week */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold font-display text-zinc-900">
            <TrendingUp className="w-5 h-5 text-[#E11D48]" />
            <span>Most Watched This Week</span>
          </h2>
          <button
            type="button"
            onClick={() => onNavigate('explore')}
            className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 inline-flex items-center gap-1"
          >
            <span>See Charts</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
        {renderVideoGrid(mostWatchedWeek, 'No weekly top videos found for this filter.')}
      </section>

      {/* 7. BharatPlay Originals */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold font-display text-zinc-900">
              <Play className="w-5 h-5 text-[#E11D48] fill-[#E11D48]" />
              <span>BharatPlay Originals</span>
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Flagship documentaries, science labs, and studio performances produced across India.
            </p>
          </div>
        </div>
        {renderVideoGrid(originals, 'No BharatPlay Originals in this category yet.')}
      </section>

      {/* 8. Regional Spotlight */}
      <section className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold font-display text-zinc-900">
              <Globe2 className="w-5 h-5 text-[#EA580C]" />
              <span>Regional Spotlight</span>
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Switch languages to explore native storytelling across India.
            </p>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {REGIONAL_SPOTLIGHT_LANGUAGES.map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setSpotlightLang(lang)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap border transition-colors ${
                  spotlightLang === lang
                    ? 'bg-[#F97316] border-[#F97316] text-white'
                    : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:text-zinc-900'
                }`}
              >
                {lang}
              </button>
            ))}
          </div>
        </div>
        {renderVideoGrid(
          regionalVideos,
          `No ${spotlightLang} videos uploaded yet. Be the first creator to publish in ${spotlightLang}!`
        )}
      </section>

      {/* 9. New Creators to Watch */}
      <section className="space-y-4 border-t border-zinc-200 pt-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold font-display text-zinc-900">
              <Users className="w-5 h-5 text-[#E11D48]" />
              <span>New Creators to Watch</span>
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Fresh voices gaining momentum · {platformConfig.creatorRevenueSharePercent || 75}% creator revenue share
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('explore')}
            className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 inline-flex items-center gap-1"
          >
            <span>Discover All</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {newCreatorsToWatch.map((c) => (
            <button
              key={c.uid}
              type="button"
              onClick={() => onOpenChannel(c.uid)}
              className="flex items-center gap-3.5 p-4 rounded-xl bg-white hover:bg-zinc-50 border border-zinc-200 text-left transition-colors"
            >
              <MediaImage
                src={c.avatarUrl}
                alt={c.displayName}
                className="w-12 h-12 rounded-full object-cover shrink-0 border border-zinc-200"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-sm font-semibold text-zinc-900 truncate">{c.displayName}</span>
                  {c.isVerified && <BadgeCheck className="w-3.5 h-3.5 text-[#EA580C] shrink-0" />}
                </div>
                <div className="text-xs text-zinc-500 mt-0.5 tabular-nums">
                  {formatCount(c.subscribersCount)} subscribers · {c.preferredLanguage || 'Hindi'}
                </div>
                <div className="text-[11px] text-[#EA580C] font-medium mt-0.5">
                  {c.rewardTier || 'Seed'} Tier · New Voice
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
