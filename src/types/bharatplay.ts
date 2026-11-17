export const VALIDATION_LIMITS = {
  DISPLAY_NAME_MAX: 80,
  HANDLE_MAX: 40,
  BIO_MAX: 500,
  VIDEO_TITLE_MAX: 150,
  VIDEO_DESC_MAX: 3000,
  COMMENT_MAX: 1000,
  PLAYLIST_TITLE_MAX: 100,
  PLAYLIST_DESC_MAX: 500,
  PLAYLIST_VIDEOS_MAX: 50,
  COMMUNITY_POST_MAX: 1500,
  SUPPORT_MSG_MAX: 280,
  CHAT_MSG_MAX: 400,
  REPORT_REASON_MAX: 500,
  TAGS_MAX: 10,
  CHAPTERS_MAX: 25,
} as const;

export type RewardTier = 'Seed' | 'Rising' | 'Star' | 'Icon';
export type UserRole = 'viewer' | 'creator' | 'admin' | 'ceo';
export type AccountLifecycleStatus = 'active' | 'suspended' | 'deleted';

export interface VideoChapter {
  timeSeconds: number;
  title: string;
}

export interface UserPublicProfile {
  id?: string;
  uid: string;
  displayName: string;
  handle: string;
  bio?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  isCreator: boolean;
  isEarlyCreator?: boolean;
  isVerified?: boolean;
  isFeatured?: boolean;
  boostEnabled?: boolean;
  leagueCategory?: string;
  preferredLanguage?: string;
  subscribersCount: number;
  totalViews: number;
  rewardTier?: RewardTier;
  accountStatus?: AccountLifecycleStatus;
  channelStatus?: AccountLifecycleStatus;
  moderationReason?: string;
  statusUpdatedAt?: any;
  createdAt: any;
  updatedAt: any;
}

export interface UserPrivateAccount {
  uid: string;
  email: string;
  role: UserRole;
  monetizationEnabled?: boolean;
  estimatedEarningsInr?: number;
  upiId?: string;
  notificationsEnabled?: boolean;
  suspended?: boolean;
  suspensionReason?: string;
  updatedAt: any;
}

export interface VideoItem {
  id: string;
  creatorId: string;
  creatorName: string;
  creatorAvatar?: string;
  title: string;
  description?: string;
  videoUrl: string;
  thumbnailUrl?: string;
  type: 'video' | 'short';
  category: string;
  language: string;
  durationSeconds?: number;
  musicTrack?: string;
  challengeId?: string;
  tags?: string[];
  chapters?: VideoChapter[];
  viewsCount: number;
  uniqueViewersCount?: number;
  totalWatchSeconds?: number;
  likesCount: number;
  dislikesCount: number;
  commentsCount: number;
  sharesCount?: number;
  status: 'published' | 'flagged' | 'removed';
  removalReason?: string;
  removedBy?: string;
  isTrending?: boolean;
  isEarlyCreatorSpotlight?: boolean;
  isOriginal?: boolean;
  createdAt: any;
  updatedAt: any;
}

export interface VideoComment {
  id: string;
  videoId: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  text: string;
  parentCommentId?: string;
  likesCount: number;
  createdAt: any;
}

export interface Subscription {
  id: string;
  subscriberId: string;
  creatorId: string;
  creatorName?: string;
  creatorAvatar?: string;
  createdAt: any;
}

export interface Playlist {
  id: string;
  ownerId: string;
  ownerName?: string;
  title: string;
  description?: string;
  visibility: 'public' | 'private';
  videoIds: string[];
  thumbnailUrl?: string;
  createdAt: any;
  updatedAt: any;
}

export interface WatchHistoryItem {
  id: string;
  userId: string;
  videoId: string;
  title: string;
  thumbnailUrl?: string;
  creatorName?: string;
  durationSeconds?: number;
  progressSeconds: number;
  maxProgressSeconds?: number;
  updatedAt: any;
}

export interface WatchLaterItem {
  id: string;
  userId: string;
  videoId: string;
  title: string;
  thumbnailUrl?: string;
  creatorId?: string;
  creatorName?: string;
  durationSeconds?: number;
  type?: 'video' | 'short';
  createdAt: any;
}

export interface CommunityPost {
  id: string;
  creatorId: string;
  creatorName: string;
  creatorAvatar?: string;
  content: string;
  imageUrl?: string;
  postType: 'text' | 'image' | 'poll' | 'announcement';
  pollOptions?: string[];
  pollVotes?: number[];
  likesCount: number;
  createdAt: any;
}

export interface CreatorSupport {
  id: string;
  supporterId: string;
  supporterName?: string;
  creatorId: string;
  creatorName?: string;
  amountInr: number;
  message?: string;
  createdAt: any;
}

export interface CollaborationRequest {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  recipientId: string;
  recipientName: string;
  recipientAvatar?: string;
  title: string;
  proposal: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: any;
  updatedAt: any;
}

export interface WatchPartyRoom {
  id: string;
  hostId: string;
  hostName: string;
  title: string;
  videoId: string;
  videoTitle: string;
  videoUrl: string;
  thumbnailUrl?: string;
  inviteCode: string;
  isPrivate: boolean;
  isPlaying: boolean;
  currentTimeSeconds: number;
  status: 'active' | 'ended';
  createdAt: any;
  updatedAt: any;
}

export interface WatchPartyMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  text: string;
  createdAt: any;
}

export interface WatchPartySyncPayload {
  partyId: string;
  videoId: string;
  isPlaying: boolean;
  currentTime: number;
  actorName?: string;
  serverTimestamp?: number;
}

export interface LiveStream {
  id: string;
  creatorId: string;
  creatorName: string;
  creatorAvatar?: string;
  title: string;
  description?: string;
  category?: string;
  language?: string;
  thumbnailUrl?: string;
  streamUrl?: string;
  isLive: boolean;
  viewerCount: number;
  startedAt: any;
}

export interface LiveChatMessage {
  id: string;
  streamId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  text: string;
  superSupportInr?: number;
  createdAt: any;
}

export interface CreatorChallenge {
  id: string;
  title: string;
  description: string;
  prizePoolInr: number;
  category?: string;
  deadline?: string;
  participantsCount: number;
  status: 'active' | 'ended';
  createdAt: any;
}

export interface LeagueCompetition {
  id: string;
  title: string;
  monthLabel: string;
  description: string;
  prizePoolInr: number;
  categories?: string[];
  winnerCreatorId?: string;
  winnerCreatorName?: string;
  status: 'active' | 'completed';
  createdAt: any;
}

export interface PlatformAnnouncement {
  id: string;
  title: string;
  body: string;
  category: 'feature' | 'league' | 'policy' | 'event';
  createdBy?: string;
  isActive: boolean;
  createdAt: any;
}

export interface ModerationReport {
  id: string;
  reporterId: string;
  targetType: 'video' | 'comment' | 'user';
  targetId: string;
  targetTitle?: string;
  reason: string;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  createdAt: any;
}

export type NotificationType =
  | 'live'
  | 'upload'
  | 'comment'
  | 'support'
  | 'reward'
  | 'system'
  | 'subscriber'
  | 'like'
  | 'collaboration'
  | 'announcement';

export interface UserNotification {
  id: string;
  recipientId: string;
  senderName?: string;
  type: NotificationType;
  title: string;
  message: string;
  linkPath?: string;
  isRead: boolean;
  createdAt: any;
}

export interface PlatformConfig {
  categories: string[];
  languages: string[];
  earlyCreatorBoostEnabled: boolean;
  creatorRevenueSharePercent: number;
  maintenanceMode?: boolean;
  updatedAt: any;
}

export interface CeoAuditLog {
  id: string;
  actorUid: string;
  actorEmail?: string;
  action: string;
  targetType: 'user' | 'channel' | 'video' | 'report' | 'announcement' | 'system';
  targetId: string;
  targetLabel?: string;
  reason: string;
  status: 'success' | 'blocked' | 'failed';
  details?: string;
  createdAt: any;
}

export interface CeoEnrichedUser extends UserPublicProfile {
  email?: string;
  role?: UserRole;
}

export interface CeoOverviewMetrics {
  totalUsers: number;
  totalCreators: number;
  totalChannels: number;
  totalVideos: number;
  publishedVideos: number;
  removedVideos: number;
  flaggedVideos: number;
  totalPlatformViews: number;
  activeUsers: number;
  suspendedAccounts: number;
  suspendedChannels: number;
  pendingReports: number;
  liveStreamsActive: number;
  activeChallenges: number;
  activeCompetitions: number;
}

export interface CeoOverviewResponse {
  metrics: CeoOverviewMetrics;
  users: CeoEnrichedUser[];
  videos: VideoItem[];
  reports: ModerationReport[];
  announcements: PlatformAnnouncement[];
  auditLogs: CeoAuditLog[];
}

export type AppRoute =
  | 'home'
  | 'explore'
  | 'shorts'
  | 'live'
  | 'watch'
  | 'search'
  | 'subscriptions'
  | 'boost'
  | 'league'
  | 'watch-party'
  | 'notifications'
  | 'watch-later'
  | 'history'
  | 'studio'
  | 'channel'
  | 'login'
  | 'signup'
  | 'settings'
  | 'admin'
  | 'ceo-command'
  | 'about'
  | 'contact'
  | 'privacy'
  | 'terms';
