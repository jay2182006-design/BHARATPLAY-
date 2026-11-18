import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { BadgeCheck, Rocket, Sparkles, TrendingUp, Flame } from 'lucide-react';
import { MediaImage } from '../components/MediaImage';
import { VideoCard } from '../components/VideoCard';
import { computeCreatorPerformance, getVideoQualityScore } from '../lib/creatorMetrics';
import { formatCount } from '../lib/formatters';
import { REGIONAL_SPOTLIGHT_LANGUAGES } from '../lib/catalogSeed';
import type { AppRoute, UserPublicProfile, VideoItem, WatchLaterItem } from '../types/bharatplay';

interface CreatorBoostPageProps {
  creators: UserPublicProfile[];
  videos: VideoItem[];
  watchLater: WatchLaterItem[];
  onWatchVideo: (video: VideoItem) => void;
  onToggleWatchLater: (video: VideoItem) => void;
  onOpenChannel: (creatorId: string) => void;
  onNavigate: (route: AppRoute) => void;
}

export function CreatorBoostPage({
  creators,
  videos,
  watchLater,
  onWatchVideo,
  onToggleWatchLater,
  onOpenChannel,
  onNavigate,
}: CreatorBoostPageProps) {
  const [selectedLang, setSelectedLang] = useState('All Languages');
  const watchLaterSet = useMemo(() => new Set(watchLater.map((w) => w.videoId)), [watchLater]);

  const creatorVerifiedMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const c of creators) map[c.uid] = Boolean(c.isVerified);
    return map;
  }, [creators]);

  const boostedRankings = useMemo(() => {
    return creators
      .filter((c) => {
        if (!c.isCreator) return false;
        if (selectedLang !== 'All Languages' && (c.preferredLanguage || 'Hindi') !== selectedLang) {
          return false;
        }
        return c.boostEnabled || c.isEarlyCreator || (c.subscribersCount || 0) < 400000;
      })
      .map((c) => computeCreatorPerformance(c, videos))
      .sort((a, b) => b.boostScore - a.boostScore);
  }, [creators, videos, selectedLang]);

  const featuredBoostCreators = useMemo(
    () => boostedRankings.filter((r) => r.creator.isFeatured || r.creator.boostEnabled).slice(0, 4),
    [boostedRankings]
  );

  const qualityVideos = useMemo(() => {
    const boostedIds = new Set(boostedRankings.map((r) => r.creator.uid));
    return [...videos]
      .filter((v) => boostedIds.has(v.creatorId) || v.isEarlyCreatorSpotlight)
      .sort((a, b) => getVideoQualityScore(b) - getVideoQualityScore(a))
      .slice(0, 8);
  }, [videos, boostedRankings]);

  return (
    <div className="max-w-[1440px] mx-auto px-4 md:px-6 lg:px-8 py-6 space-y-10">
      {/* Header Banner */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-gradient-to-br from-orange-50 via-white to-rose-50/70 dark:from-[#141418] dark:via-[#111115] dark:to-orange-950/20 border border-orange-200 dark:border-zinc-800 p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6"
      >
        <div className="space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#EA580C] dark:text-[#F97316]">
            <Rocket className="w-4 h-4" />
            <span>BharatPlay Creator Boost Program</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold font-display text-zinc-900 dark:text-white">
            Quality-First Discovery for Emerging Indian Creators
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
            New and rising creators are spotlighted based on authentic audience retention, genuine discussion, and completion rate — never artificial views or paid inflation.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <select
            value={selectedLang}
            onChange={(e) => setSelectedLang(e.target.value)}
            aria-label="Filter Creator Boost by language"
            className="px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-xs font-semibold text-zinc-900 dark:text-white"
          >
            <option value="All Languages">All Languages</option>
            {REGIONAL_SPOTLIGHT_LANGUAGES.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => onNavigate('studio')}
            className="px-4 py-2.5 rounded-xl bg-[#E11D48] hover:bg-[#BE123C] text-xs font-semibold text-white whitespace-nowrap"
          >
            Creator Studio
          </button>
        </div>
      </motion.section>

      {/* Featured Boosted Creators */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[#EA580C] dark:text-[#F97316]" />
          <h2 className="text-lg font-bold font-display text-zinc-900 dark:text-white">Featured Rising Creators</h2>
        </div>

        {featuredBoostCreators.length === 0 ? (
          <div className="p-8 rounded-xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 text-sm text-zinc-600 dark:text-zinc-400 text-center">
            No rising creators match {selectedLang}. Try switching back to All Languages.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {featuredBoostCreators.map((item) => (
              <button
                key={item.creator.uid}
                type="button"
                onClick={() => onOpenChannel(item.creator.uid)}
                className="p-5 rounded-2xl bg-white dark:bg-[#111115] hover:bg-zinc-50 dark:hover:bg-[#16161C] border border-zinc-200 dark:border-zinc-800 hover:border-[#F97316] text-left transition-all space-y-3 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <MediaImage
                    src={item.creator.avatarUrl}
                    alt={item.creator.displayName}
                    className="w-12 h-12 rounded-full object-cover border border-zinc-200 dark:border-zinc-700 shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-zinc-900 dark:text-white truncate">
                        {item.creator.displayName}
                      </span>
                      {item.creator.isVerified && <BadgeCheck className="w-4 h-4 text-[#EA580C] dark:text-[#F97316] shrink-0" />}
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                      {item.creator.preferredLanguage || 'Hindi'} · {formatCount(item.creator.subscribersCount)} subs
                    </div>
                  </div>
                </div>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2">{item.creator.bio}</p>
                <div className="flex items-center justify-between pt-2 border-t border-zinc-200 dark:border-zinc-800 text-[11px]">
                  <span className="px-2 py-0.5 rounded bg-orange-50 dark:bg-orange-950/40 text-[#EA580C] dark:text-[#FDBA74] font-semibold">
                    Rising Creator
                  </span>
                  <span className="font-mono text-zinc-700 dark:text-zinc-300 tabular-nums">
                    Boost {item.boostScore}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Weekly Creator Boost Rankings */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold font-display text-zinc-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#E11D48]" />
              <span>Weekly Creator Rankings</span>
            </h2>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
              Scored purely from organic viewer retention %, engagement ratio, and upload consistency.
            </p>
          </div>
        </div>

        <div className="rounded-2xl bg-white dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 overflow-x-auto shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-[#141418] border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className="p-4 font-medium">Rank</th>
                <th className="p-4 font-medium">Creator</th>
                <th className="p-4 font-medium">Language</th>
                <th className="p-4 font-medium text-right">Retention</th>
                <th className="p-4 font-medium text-right">Engagement</th>
                <th className="p-4 font-medium text-right">Quality Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {boostedRankings.map((row, idx) => (
                <tr key={row.creator.uid} className="hover:bg-zinc-50 dark:hover:bg-[#16161C]">
                  <td className="p-4 font-mono font-bold text-[#EA580C] dark:text-[#F97316]">#{idx + 1}</td>
                  <td className="p-4">
                    <button
                      type="button"
                      onClick={() => onOpenChannel(row.creator.uid)}
                      className="flex items-center gap-3 text-left group"
                    >
                      <MediaImage
                        src={row.creator.avatarUrl}
                        alt={row.creator.displayName}
                        className="w-9 h-9 rounded-full object-cover border border-zinc-200 dark:border-zinc-700"
                      />
                      <div>
                        <div className="flex items-center gap-1.5 font-semibold text-zinc-900 dark:text-white group-hover:text-[#EA580C] dark:group-hover:text-[#F97316]">
                          <span>{row.creator.displayName}</span>
                          {row.creator.isVerified && <BadgeCheck className="w-3.5 h-3.5 text-[#EA580C] dark:text-[#F97316]" />}
                        </div>
                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                          {formatCount(row.creator.subscribersCount)} subscribers
                        </div>
                      </div>
                    </button>
                  </td>
                  <td className="p-4 text-zinc-700 dark:text-zinc-300">{row.creator.preferredLanguage || 'Hindi'}</td>
                  <td className="p-4 text-right font-mono tabular-nums text-zinc-900 dark:text-white">{row.retentionPct}%</td>
                  <td className="p-4 text-right font-mono tabular-nums text-zinc-700 dark:text-zinc-300">{row.engagementRatePct}%</td>
                  <td className="p-4 text-right font-mono font-bold tabular-nums text-[#E11D48]">
                    {row.boostScore}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* High-Retention Discovery Videos */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Flame className="w-5 h-5 text-[#EA580C] dark:text-[#F97316]" />
          <h2 className="text-lg font-bold font-display text-zinc-900 dark:text-white">Boosted Discovery Feed</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {qualityVideos.map((v) => (
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
      </section>
    </div>
  );
}
