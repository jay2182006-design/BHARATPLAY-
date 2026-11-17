import type { UserPublicProfile, VideoItem } from '../types/bharatplay';

export interface CreatorPerformanceStats {
  creator: UserPublicProfile;
  videosCount: number;
  totalViews: number;
  uniqueViewers: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalWatchSeconds: number;
  retentionPct: number;
  engagementRatePct: number;
  boostScore: number;
  leagueScore: number;
  primaryCategory: string;
}

export function computeCreatorPerformance(
  creator: UserPublicProfile,
  allVideos: VideoItem[]
): CreatorPerformanceStats {
  const vids = allVideos.filter((v) => v.creatorId === creator.uid && v.status === 'published');
  const totalViews = vids.reduce((acc, v) => acc + (v.viewsCount || 0), 0);
  const uniqueViewers = vids.reduce(
    (acc, v) => acc + (v.uniqueViewersCount ?? Math.round((v.viewsCount || 0) * 0.84)),
    0
  );
  const totalLikes = vids.reduce((acc, v) => acc + (v.likesCount || 0), 0);
  const totalComments = vids.reduce((acc, v) => acc + (v.commentsCount || 0), 0);
  const totalShares = vids.reduce((acc, v) => acc + (v.sharesCount || 0), 0);
  const totalWatchSeconds = vids.reduce((acc, v) => acc + (v.totalWatchSeconds || 0), 0);
  const avgDuration =
    vids.length > 0
      ? vids.reduce((acc, v) => acc + Math.max(1, v.durationSeconds || 8), 0) / vids.length
      : 8;

  const avgWatchPerView = totalViews > 0 ? totalWatchSeconds / totalViews : 0;
  const retentionPct =
    totalWatchSeconds > 0 && avgDuration > 0
      ? Math.min(100, Math.max(5, Math.round((avgWatchPerView / avgDuration) * 100)))
      : totalViews > 0
      ? 62
      : 0;

  const engagementRatePct =
    totalViews > 0
      ? Number((((totalLikes + totalComments * 2 + totalShares * 2) / totalViews) * 100).toFixed(1))
      : 0;

  const boostScore = Number(
    (
      Math.min(25, engagementRatePct) * 2.2 +
      retentionPct * 0.45 +
      (creator.isEarlyCreator || creator.boostEnabled ? 12 : 0) +
      Math.min(10, vids.length * 2)
    ).toFixed(1)
  );

  const leagueScore = Math.round(
    (totalViews / 1000) * 2.5 +
      totalLikes * 0.12 +
      totalComments * 5 +
      totalShares * 2 +
      retentionPct * 3
  );

  const catCounts: Record<string, number> = {};
  for (const v of vids) {
    catCounts[v.category] = (catCounts[v.category] || 0) + 1;
  }
  const primaryCategory =
    creator.leagueCategory ||
    Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ||
    'Entertainment';

  return {
    creator,
    videosCount: vids.length,
    totalViews,
    uniqueViewers,
    totalLikes,
    totalComments,
    totalShares,
    totalWatchSeconds,
    retentionPct,
    engagementRatePct,
    boostScore,
    leagueScore,
    primaryCategory,
  };
}

export function getVideoQualityScore(video: VideoItem): number {
  const views = Math.max(1, video.viewsCount || 0);
  const engagement = ((video.likesCount || 0) + (video.commentsCount || 0) * 3) / views;
  const duration = Math.max(1, video.durationSeconds || 8);
  const retention =
    video.totalWatchSeconds && video.viewsCount
      ? Math.min(1, video.totalWatchSeconds / (video.viewsCount * duration))
      : 0.65;
  return engagement * 100 + retention * 50;
}
