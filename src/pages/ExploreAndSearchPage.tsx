import React, { useMemo, useState } from 'react';
import {
  Award,
  BadgeCheck,
  Filter,
  Flame,
  Globe2,
  Search,
  Sparkles,
  Trophy,
  Vote,
} from 'lucide-react';
import { VideoCard } from '../components/VideoCard';
import { MediaImage } from '../components/MediaImage';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import { voteCommunityPoll } from '../lib/bharatplayService';
import { DEFAULT_CATEGORIES, REGIONAL_SPOTLIGHT_LANGUAGES } from '../lib/catalogSeed';
import { formatCount, formatInr, formatRelativeDate } from '../lib/formatters';
import type {
  AppRoute,
  CommunityPost,
  CreatorChallenge,
  PlatformConfig,
  UserPublicProfile,
  VideoItem,
  WatchLaterItem,
} from '../types/bharatplay';

interface ExploreAndSearchPageProps {
  mode: 'explore' | 'search';
  searchQuery: string;
  videos: VideoItem[];
  creators: UserPublicProfile[];
  challenges: CreatorChallenge[];
  communityPosts: CommunityPost[];
  platformConfig: PlatformConfig;
  watchLater: WatchLaterItem[];
  onWatchVideo: (video: VideoItem) => void;
  onToggleWatchLater: (video: VideoItem) => void;
  onOpenChannel: (creatorId: string) => void;
  onOpenUploadForChallenge: () => void;
  onNavigate: (route: AppRoute) => void;
}

export function ExploreAndSearchPage({
  mode,
  searchQuery,
  videos,
  creators,
  challenges,
  communityPosts,
  platformConfig,
  watchLater,
  onWatchVideo,
  onToggleWatchLater,
  onOpenChannel,
  onOpenUploadForChallenge,
  onNavigate,
}: ExploreAndSearchPageProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'trending' | 'regions' | 'early' | 'challenges' | 'community'>('trending');
  const [selectedRegion, setSelectedRegion] = useState<string>('Hindi');
  const [votedPosts, setVotedPosts] = useState<Record<string, boolean>>({});

  // Search Filters
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterLanguage, setFilterLanguage] = useState('All Languages');
  const [filterType, setFilterType] = useState<'all' | 'video' | 'short'>('all');
  const [sortBy, setSortBy] = useState<'latest' | 'views' | 'likes'>('latest');

  const creatorVerifiedMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const c of creators) map[c.uid] = Boolean(c.isVerified);
    return map;
  }, [creators]);

  const watchLaterSet = useMemo(() => new Set(watchLater.map((w) => w.videoId)), [watchLater]);

  const q = searchQuery.trim().toLowerCase();

  const searchVideoResults = useMemo(() => {
    const filtered = videos.filter((v) => {
      if (filterCategory !== 'All' && v.category !== filterCategory) return false;
      if (filterLanguage !== 'All Languages' && v.language !== filterLanguage) return false;
      if (filterType !== 'all' && v.type !== filterType) return false;
      if (!q) return true;
      return (
        v.title.toLowerCase().includes(q) ||
        v.creatorName.toLowerCase().includes(q) ||
        v.category.toLowerCase().includes(q) ||
        v.language.toLowerCase().includes(q) ||
        (v.description || '').toLowerCase().includes(q)
      );
    });
    return [...filtered].sort((a, b) => {
      if (sortBy === 'views') return b.viewsCount - a.viewsCount;
      if (sortBy === 'likes') return b.likesCount - a.likesCount;
      return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
    });
  }, [videos, q, filterCategory, filterLanguage, filterType, sortBy]);

  const searchCreatorResults = useMemo(() => {
    if (!q) return [];
    return creators.filter(
      (c) =>
        c.displayName.toLowerCase().includes(q) ||
        c.handle.toLowerCase().includes(q) ||
        (c.bio || '').toLowerCase().includes(q)
    );
  }, [creators, q]);

  const earlyCreatorVideos = useMemo(
    () => videos.filter((v) => v.isEarlyCreatorSpotlight || v.viewsCount < 350000),
    [videos]
  );

  const regionalFeedVideos = useMemo(
    () => videos.filter((v) => v.language === selectedRegion),
    [videos, selectedRegion]
  );

  const handleVote = async (post: CommunityPost, idx: number) => {
    if (!user) {
      showToast('Sign in to vote in creator community polls.', 'info');
      onNavigate('login');
      return;
    }
    if (votedPosts[post.id]) {
      showToast('You already voted in this poll.', 'info');
      return;
    }
    try {
      await voteCommunityPoll(post, idx);
      setVotedPosts((p) => ({ ...p, [post.id]: true }));
      showToast('Vote recorded!', 'success');
    } catch {
      showToast('Could not submit vote.', 'error');
    }
  };

  const categories = ['All', ...(platformConfig.categories?.length ? platformConfig.categories : DEFAULT_CATEGORIES.slice(1))];
  const languages = ['All Languages', ...(platformConfig.languages?.length ? platformConfig.languages : REGIONAL_SPOTLIGHT_LANGUAGES)];

  if (mode === 'search') {
    return (
      <div className="max-w-[1440px] mx-auto px-4 md:px-6 lg:px-8 py-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 pb-4">
          <div className="flex items-center gap-2.5">
            <Search className="w-5 h-5 text-[#EA580C]" />
            <h1 className="text-xl font-bold font-display text-zinc-900">
              Results for “{searchQuery || 'All'}”
            </h1>
          </div>
          <span className="text-xs text-zinc-500 tabular-nums">
            {searchVideoResults.length} videos · {searchCreatorResults.length} channels
          </span>
        </div>

        {/* Advanced Search Filters */}
        <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl bg-zinc-50 border border-zinc-200">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700">
            <Filter className="w-3.5 h-3.5 text-[#EA580C]" />
            Filters:
          </span>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-white border border-zinc-300 text-xs text-zinc-900"
          >
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            value={filterLanguage}
            onChange={(e) => setFilterLanguage(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-white border border-zinc-300 text-xs text-zinc-900"
          >
            {languages.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="px-3 py-1.5 rounded-lg bg-white border border-zinc-300 text-xs text-zinc-900"
          >
            <option value="all">All Formats</option>
            <option value="video">Videos (16:9)</option>
            <option value="short">Shorts (9:16)</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-1.5 rounded-lg bg-white border border-zinc-300 text-xs text-zinc-900"
          >
            <option value="latest">Sort: Latest</option>
            <option value="views">Sort: Most Viewed</option>
            <option value="likes">Sort: Most Liked</option>
          </select>
        </div>

        {searchCreatorResults.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-zinc-700">Channels</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {searchCreatorResults.map((c) => (
                <button
                  key={c.uid}
                  type="button"
                  onClick={() => onOpenChannel(c.uid)}
                  className="flex items-center gap-3.5 p-4 rounded-xl bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-left"
                >
                  <MediaImage src={c.avatarUrl} alt={c.displayName} className="w-12 h-12 rounded-full object-cover border border-zinc-200" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-sm font-bold text-zinc-900 truncate">
                      <span>{c.displayName}</span>
                      {c.isVerified && <BadgeCheck className="w-3.5 h-3.5 text-[#EA580C]" />}
                    </div>
                    <div className="text-xs text-zinc-500 truncate">
                      @{c.handle} · {formatCount(c.subscribersCount)} subscribers
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {searchVideoResults.length === 0 ? (
          <div className="p-12 rounded-2xl bg-zinc-50 border border-zinc-200 text-center space-y-2">
            <p className="text-base font-semibold text-zinc-900">No matching videos found</p>
            <p className="text-sm text-zinc-600">
              Try adjusting your filters or searching for Tech, Music, Rajasthani, Hindi, or Telugu content.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {searchVideoResults.map((v) => (
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
    <div className="max-w-[1440px] mx-auto px-4 md:px-6 lg:px-8 py-6 space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-display text-zinc-900">Explore & Regional India</h1>
          <p className="text-sm text-zinc-600 mt-1">
            Discover 8+ Indian language hubs, Early Creator spotlights, weekly creator challenges, and community polls.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-zinc-100 border border-zinc-200 rounded-xl overflow-x-auto no-scrollbar">
          {[
            { id: 'trending', label: 'Trending', icon: <Flame className="w-3.5 h-3.5" /> },
            { id: 'regions', label: 'Regional Discovery', icon: <Globe2 className="w-3.5 h-3.5" /> },
            { id: 'early', label: 'Early Creators', icon: <Sparkles className="w-3.5 h-3.5" /> },
            { id: 'challenges', label: 'Challenges', icon: <Trophy className="w-3.5 h-3.5" /> },
            { id: 'community', label: 'Community', icon: <Vote className="w-3.5 h-3.5" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                activeTab === tab.id ? 'bg-[#E11D48] text-white' : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'trending' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 rounded-xl bg-zinc-50 border border-zinc-200 space-y-1.5">
              <Globe2 className="w-5 h-5 text-[#EA580C]" />
              <div className="text-sm font-bold text-zinc-900">Regional India First</div>
              <p className="text-xs text-zinc-600">
                Dedicated hubs for Hindi, English, Punjabi, Rajasthani, Tamil, Telugu, Bengali, and Marathi.
              </p>
            </div>
            <div className="p-5 rounded-xl bg-zinc-50 border border-zinc-200 space-y-1.5">
              <Sparkles className="w-5 h-5 text-[#E11D48]" />
              <div className="text-sm font-bold text-zinc-900">Early Creator Program</div>
              <p className="text-xs text-zinc-600">
                Emerging Indian channels receive dedicated homepage discovery and zero-threshold fan support.
              </p>
            </div>
            <div className="p-5 rounded-xl bg-zinc-50 border border-zinc-200 space-y-1.5">
              <Award className="w-5 h-5 text-[#EA580C]" />
              <div className="text-sm font-bold text-zinc-900">BharatPlay Rewards</div>
              <p className="text-xs text-zinc-600">
                Creators earn milestone payouts and tier boosts as organic audience watch-time grows.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {videos.map((v) => (
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
        </div>
      )}

      {activeTab === 'regions' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
            {REGIONAL_SPOTLIGHT_LANGUAGES.map((lang) => {
              const count = videos.filter((v) => v.language === lang).length;
              const active = selectedRegion === lang;
              return (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setSelectedRegion(lang)}
                  className={`p-3 rounded-xl border text-left transition-colors ${
                    active
                      ? 'bg-rose-50 border-[#E11D48] text-[#BE123C]'
                      : 'bg-zinc-50 border-zinc-200 text-zinc-800 hover:border-zinc-300'
                  }`}
                >
                  <div className="text-sm font-bold">{lang}</div>
                  <div className={`text-[11px] mt-0.5 tabular-nums ${active ? 'text-[#E11D48]' : 'text-zinc-500'}`}>{count} videos</div>
                </button>
              );
            })}
          </div>

          {regionalFeedVideos.length === 0 ? (
            <div className="p-10 rounded-2xl bg-zinc-50 border border-zinc-200 text-center space-y-2">
              <p className="text-sm font-semibold text-zinc-900">No {selectedRegion} videos yet</p>
              <p className="text-xs text-zinc-600">
                Upload a video or Short in {selectedRegion} to launch this regional feed.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {regionalFeedVideos.map((v) => (
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
      )}

      {activeTab === 'early' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-zinc-50 border border-zinc-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold font-display text-zinc-900">Early Creator Discovery Program</h2>
              <p className="text-sm text-zinc-600 mt-1">
                Every emerging Indian storyteller gets algorithmic spotlighting based on quality & retention.
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenUploadForChallenge}
              className="px-4 py-2.5 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-xs font-semibold text-white whitespace-nowrap"
            >
              Publish as Early Creator
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {earlyCreatorVideos.map((v) => (
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
        </div>
      )}

      {activeTab === 'challenges' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {challenges.map((ch) => (
            <div key={ch.id} className="p-6 rounded-2xl bg-zinc-50 border border-zinc-200 flex flex-col justify-between gap-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#EA580C] font-semibold">{ch.category || 'Creator Challenge'}</span>
                  <span className="text-zinc-500 tabular-nums">Deadline: {ch.deadline || 'Open'}</span>
                </div>
                <h2 className="text-xl font-bold font-display text-zinc-900">{ch.title}</h2>
                <p className="text-sm text-zinc-600 leading-relaxed">{ch.description}</p>
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-zinc-200">
                <div>
                  <div className="text-xs text-zinc-500">Reward Pool</div>
                  <div className="text-lg font-bold font-mono tabular-nums text-zinc-900">
                    {formatInr(ch.prizePoolInr)}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-zinc-500 tabular-nums">{ch.participantsCount} entries</span>
                  <button
                    type="button"
                    onClick={onOpenUploadForChallenge}
                    className="px-4 py-2 rounded-xl bg-[#E11D48] hover:bg-[#BE123C] text-xs font-semibold text-white"
                  >
                    Enter Challenge
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'community' && (
        <div className="max-w-3xl space-y-5">
          {communityPosts.map((post) => {
            const totalVotes = (post.pollVotes || []).reduce((a, b) => a + b, 0);
            return (
              <div key={post.id} className="p-5 rounded-2xl bg-white border border-zinc-200 space-y-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => onOpenChannel(post.creatorId)}>
                    <MediaImage
                      src={post.creatorAvatar}
                      alt={post.creatorName}
                      className="w-10 h-10 rounded-full object-cover border border-zinc-200"
                    />
                  </button>
                  <div>
                    <button
                      type="button"
                      onClick={() => onOpenChannel(post.creatorId)}
                      className="text-sm font-bold text-zinc-900 hover:text-[#EA580C]"
                    >
                      {post.creatorName}
                    </button>
                    <div className="text-xs text-zinc-500">
                      {post.postType} · {formatRelativeDate(post.createdAt)}
                    </div>
                  </div>
                </div>

                <p className="text-sm text-zinc-700 leading-relaxed">{post.content}</p>

                {post.imageUrl && (
                  <div className="rounded-xl overflow-hidden max-h-80 border border-zinc-200">
                    <MediaImage src={post.imageUrl} alt="Community attachment" className="w-full h-full object-cover" />
                  </div>
                )}

                {post.postType === 'poll' && post.pollOptions && post.pollOptions.length > 0 && (
                  <div className="space-y-2 pt-1">
                    {post.pollOptions.map((opt, idx) => {
                      const votes = post.pollVotes?.[idx] || 0;
                      const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleVote(post, idx)}
                          className="relative w-full text-left px-4 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 hover:border-[#F97316] overflow-hidden transition-colors"
                        >
                          <div
                            className="absolute inset-y-0 left-0 bg-rose-100/80 transition-all duration-300"
                            style={{ width: `${pct}%` }}
                          />
                          <div className="relative flex items-center justify-between text-xs">
                            <span className="font-medium text-zinc-900">{opt}</span>
                            <span className="font-mono tabular-nums text-zinc-700">{pct}%</span>
                          </div>
                        </button>
                      );
                    })}
                    <div className="text-xs text-zinc-500 tabular-nums">{totalVotes} total votes</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
