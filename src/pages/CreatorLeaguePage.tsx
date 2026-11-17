import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Award, BadgeCheck, Crown, Flame, GraduationCap, Sparkles, Trophy } from 'lucide-react';
import { MediaImage } from '../components/MediaImage';
import { computeCreatorPerformance } from '../lib/creatorMetrics';
import { formatCount, formatInr } from '../lib/formatters';
import type { LeagueCompetition, UserPublicProfile, VideoItem } from '../types/bharatplay';

interface CreatorLeaguePageProps {
  creators: UserPublicProfile[];
  videos: VideoItem[];
  competitions: LeagueCompetition[];
  onOpenChannel: (creatorId: string) => void;
}

const LEAGUE_TRACKS = [
  { id: 'all', label: 'Top 10 Overall', icon: <Trophy className="w-3.5 h-3.5" /> },
  { id: 'Education', label: 'Best Educational Creator', icon: <GraduationCap className="w-3.5 h-3.5" /> },
  { id: 'Entertainment', label: 'Best Entertainment Creator', icon: <Flame className="w-3.5 h-3.5" /> },
  { id: 'Rising Star', label: 'Rising Star', icon: <Sparkles className="w-3.5 h-3.5" /> },
] as const;

export function CreatorLeaguePage({
  creators,
  videos,
  competitions,
  onOpenChannel,
}: CreatorLeaguePageProps) {
  const [selectedTrack, setSelectedTrack] = useState<string>('all');

  const activeSeason = competitions.find((c) => c.status === 'active') || competitions[0];

  const allStats = useMemo(() => {
    return creators
      .filter((c) => c.isCreator)
      .map((c) => computeCreatorPerformance(c, videos))
      .sort((a, b) => b.leagueScore - a.leagueScore);
  }, [creators, videos]);

  const top10Overall = useMemo(() => allStats.slice(0, 10), [allStats]);

  const filteredLeaderboard = useMemo(() => {
    if (selectedTrack === 'all') return top10Overall;
    return allStats
      .filter((item) => {
        if (selectedTrack === 'Rising Star') {
          return item.primaryCategory === 'Rising Star' || item.creator.isEarlyCreator || item.creator.boostEnabled;
        }
        return item.primaryCategory === selectedTrack;
      })
      .slice(0, 10);
  }, [allStats, top10Overall, selectedTrack]);

  const trackLeaders = useMemo(() => {
    return [
      {
        title: 'Best Educational Creator',
        leader: allStats.find((s) => s.primaryCategory === 'Education') || allStats[0],
        accent: 'text-sky-600',
      },
      {
        title: 'Best Entertainment Creator',
        leader: allStats.find((s) => s.primaryCategory === 'Entertainment') || allStats[1] || allStats[0],
        accent: 'text-[#E11D48]',
      },
      {
        title: 'Rising Star',
        leader:
          allStats.find((s) => s.primaryCategory === 'Rising Star' || s.creator.isEarlyCreator) ||
          allStats[2] ||
          allStats[0],
        accent: 'text-[#EA580C]',
      },
    ];
  }, [allStats]);

  return (
    <div className="max-w-[1440px] mx-auto px-4 md:px-6 lg:px-8 py-6 space-y-8">
      {/* Season Hero */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-gradient-to-br from-rose-50/80 via-white to-orange-50/70 border border-rose-200 p-6 md:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6"
      >
        <div className="space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#EA580C]">
            <Trophy className="w-4 h-4" />
            <span>{activeSeason?.monthLabel || 'Monthly Championship'}</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold font-display text-zinc-900">
            {activeSeason?.title || 'BharatPlay Creator League'}
          </h1>
          <p className="text-sm text-zinc-600 leading-relaxed">
            {activeSeason?.description ||
              'Monthly creator championship ranked transparently across Education, Entertainment, and Rising Star tracks.'}
          </p>
        </div>

        <div className="flex items-center gap-6 p-4 rounded-xl bg-white border border-zinc-200 shadow-sm shrink-0">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-zinc-500">Monthly Prize Pool</div>
            <div className="text-2xl font-bold font-mono tabular-nums text-[#EA580C] mt-0.5">
              {formatInr(activeSeason?.prizePoolInr || 500000)}
            </div>
          </div>
          <div className="w-px h-10 bg-zinc-200" />
          <div>
            <div className="text-[11px] uppercase tracking-wider text-zinc-500">Status</div>
            <div className="text-sm font-bold text-emerald-600 uppercase mt-1">
              {activeSeason?.status || 'Active'}
            </div>
          </div>
        </div>
      </motion.section>

      {/* Category Track Leaders */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {trackLeaders.map(({ title, leader, accent }) => (
          <div key={title} className="p-5 rounded-2xl bg-white border border-zinc-200 shadow-sm space-y-3">
            <div className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${accent}`}>
              <Crown className="w-4 h-4" />
              <span>{title}</span>
            </div>
            {leader ? (
              <button
                type="button"
                onClick={() => onOpenChannel(leader.creator.uid)}
                className="w-full flex items-center gap-3 text-left group"
              >
                <MediaImage
                  src={leader.creator.avatarUrl}
                  alt={leader.creator.displayName}
                  className="w-12 h-12 rounded-full object-cover border border-zinc-200 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 font-bold text-zinc-900 group-hover:text-[#EA580C] truncate">
                    <span className="truncate">{leader.creator.displayName}</span>
                    {leader.creator.isVerified && <BadgeCheck className="w-4 h-4 text-[#EA580C] shrink-0" />}
                  </div>
                  <div className="text-xs text-zinc-500 mt-0.5 tabular-nums">
                    {leader.leagueScore.toLocaleString('en-IN')} pts · {leader.retentionPct}% retention
                  </div>
                </div>
              </button>
            ) : (
              <p className="text-xs text-zinc-500">No qualifiers yet.</p>
            )}
          </div>
        ))}
      </section>

      {/* Track Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {LEAGUE_TRACKS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSelectedTrack(t.id)}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap border transition-colors ${
              selectedTrack === t.id
                ? 'bg-[#E11D48] border-[#E11D48] text-white'
                : 'bg-zinc-100 border-zinc-200 text-zinc-700 hover:text-zinc-900'
            }`}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Top 10 Monthly Leaderboard */}
      <section className="rounded-2xl bg-white border border-zinc-200 overflow-x-auto shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="text-zinc-500 bg-zinc-50 border-b border-zinc-200">
            <tr>
              <th className="p-4 font-medium">Pos</th>
              <th className="p-4 font-medium">Creator</th>
              <th className="p-4 font-medium">Category Track</th>
              <th className="p-4 font-medium text-right">Subscribers</th>
              <th className="p-4 font-medium text-right">Engagement</th>
              <th className="p-4 font-medium text-right">League Points</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {filteredLeaderboard.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-zinc-500">
                  No creators ranked in this category track yet.
                </td>
              </tr>
            ) : (
              filteredLeaderboard.map((row, idx) => (
                <tr key={row.creator.uid} className="hover:bg-zinc-50">
                  <td className="p-4 font-mono font-bold">
                    <span
                      className={`inline-flex items-center justify-center w-7 h-7 rounded-lg ${
                        idx === 0
                          ? 'bg-[#F97316] text-white'
                          : idx === 1
                          ? 'bg-zinc-300 text-zinc-950'
                          : idx === 2
                          ? 'bg-amber-700 text-white'
                          : 'bg-zinc-100 text-zinc-700'
                      }`}
                    >
                      {idx + 1}
                    </span>
                  </td>
                  <td className="p-4">
                    <button
                      type="button"
                      onClick={() => onOpenChannel(row.creator.uid)}
                      className="flex items-center gap-3 text-left group"
                    >
                      <MediaImage
                        src={row.creator.avatarUrl}
                        alt={row.creator.displayName}
                        className="w-10 h-10 rounded-full object-cover border border-zinc-200"
                      />
                      <div>
                        <div className="flex items-center gap-1.5 font-semibold text-zinc-900 group-hover:text-[#EA580C]">
                          <span>{row.creator.displayName}</span>
                          {row.creator.isVerified && <BadgeCheck className="w-4 h-4 text-[#EA580C]" />}
                        </div>
                        <div className="text-[11px] text-zinc-500">
                          @{row.creator.handle} · {row.creator.preferredLanguage || 'Hindi'}
                        </div>
                      </div>
                    </button>
                  </td>
                  <td className="p-4">
                    <span className="px-2.5 py-1 rounded-lg bg-zinc-100 border border-zinc-200 text-zinc-800">
                      {row.primaryCategory}
                    </span>
                  </td>
                  <td className="p-4 text-right font-mono tabular-nums text-zinc-700">
                    {formatCount(row.creator.subscribersCount)}
                  </td>
                  <td className="p-4 text-right font-mono tabular-nums text-zinc-700">
                    {row.engagementRatePct}%
                  </td>
                  <td className="p-4 text-right font-mono font-bold tabular-nums text-[#EA580C]">
                    {row.leagueScore.toLocaleString('en-IN')} pts
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {/* Past & Active Seasons */}
      {competitions.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-bold text-zinc-900 flex items-center gap-2">
            <Award className="w-4 h-4 text-[#E11D48]" />
            <span>League Seasons</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {competitions.map((comp) => (
              <div key={comp.id} className="p-5 rounded-xl bg-zinc-50 border border-zinc-200 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#EA580C] font-semibold">{comp.monthLabel}</span>
                  <span className="uppercase font-bold text-emerald-600">{comp.status}</span>
                </div>
                <div className="text-base font-bold text-zinc-900">{comp.title}</div>
                <p className="text-xs text-zinc-600">{comp.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
