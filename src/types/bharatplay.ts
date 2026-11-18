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

export type AdminPermissionKey =
  | 'moderateVideos'
  | 'resolveReports'
  | 'manageCreators'
  | 'manageCompetitions'
  | 'manageAnnouncements'
  | 'manageCategories'
  | 'manageMonetization';

export interface AdminPermissions {
  moderateVideos: boolean;
  resolveReports: boolean;
  manageCreators: boolean;
  manageCompetitions: boolean;
  manageAnnouncements: boolean;
  manageCategories: boolean;
  manageMonetization?: boolean;
}

export const DEFAULT_ADMIN_PERMISSIONS: AdminPermissions = {
  moderateVideos: false,
  resolveReports: false,
  manageCreators: false,
  manageCompetitions: false,
  manageAnnouncements: false,
  manageCategories: false,
  manageMonetization: false,
};

export const ADMIN_PERMISSION_LABELS: Record<
  AdminPermissionKey,
  { label: string; description: string }
> = {
  moderateVideos: {
    label: 'Moderate Videos',
    description: 'Flag, soft-remove, restore, and curate Trending / Originals status (cannot permanently delete).',
  },
  resolveReports: {
    label: 'Review & Resolve Reports',
    description: 'Inspect user/video reports and mark them reviewed, resolved, or dismissed.',
  },
  manageCreators: {
    label: 'Manage Creators & Boost',
    description: 'Toggle Creator Boost, Rising tier, Featured spotlight, and creator badges (no account deletion).',
  },
  manageCompetitions: {
    label: 'Manage League & Challenges',
    description: 'Launch and update monthly Creator League competitions and weekly challenges.',
  },
  manageAnnouncements: {
    label: 'Publish Announcements',
    description: 'Publish and archive non-CEO platform updates and event notices.',
  },
  manageCategories: {
    label: 'Manage Categories',
    description: 'Add or remove discovery categories without altering monetization or platform settings.',
  },
  manageMonetization: {
    label: 'Review Monetization & Disputes',
    description: 'Review invalid traffic flags, payment disputes, and Brand Connect applications (cannot alter platform revenue percentages or delete users).',
  },
};

export interface AdminRecord {
  uid: string;
  displayName?: string;
  email?: string;
  permissions: AdminPermissions;
  grantedBy: string;
  notes?: string;
  grantedAt?: any;
  updatedAt?: any;
}

export interface CreatorPayout {
  id: string;
  creatorId: string;
  creatorName: string;
  creatorHandle?: string;
  upiId: string;
  amountInr: number;
  periodLabel?: string;
  status: 'pending' | 'approved' | 'paid' | 'rejected';
  notes?: string;
  processedByUid?: string;
  createdAt: any;
  updatedAt: any;
}

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

export type ThemeMode = 'dark' | 'light';

export interface UserPrivateAccount {
  uid: string;
  email: string;
  role: UserRole;
  monetizationEnabled?: boolean;
  estimatedEarningsInr?: number;
  availableBalanceInr?: number;
  pendingBalanceInr?: number;
  lifetimeEarningsInr?: number;
  monetizationTermsAcceptedAt?: string;
  upiId?: string;
  notificationsEnabled?: boolean;
  themePreference?: ThemeMode;
  suspended?: boolean;
  suspensionReason?: string;
  updatedAt: any;
}

export type VideoAccessType = 'free' | 'members_only' | 'paid';

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
  accessType?: VideoAccessType;
  priceInr?: number;
  adsEnabled?: boolean;
  adEligibility?: 'eligible' | 'limited' | 'ineligible';
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
  paymentOrderId?: string;
  paymentVerified?: boolean;
  status?: 'pending_verification' | 'verified' | 'rejected' | 'refunded';
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
  adSharePercent?: number;
  membershipSharePercent?: number;
  supportSharePercent?: number;
  paidVideoSharePercent?: number;
  paymentGatewayMode?: 'unconfigured' | 'test' | 'live';
  minPayoutInr?: number;
  maintenanceMode?: boolean;
  updatedAt: any;
}

// --- Creator Monetization System Entities ---

export interface AdRevenueRecord {
  id: string;
  videoId: string;
  videoTitle: string;
  creatorId: string;
  creatorName: string;
  periodLabel: string;
  validImpressions: number;
  invalidImpressionsBlocked: number;
  grossAdRevenueInr: number;
  creatorSharePercent: number;
  creatorNetInr: number;
  status: 'pending' | 'verified' | 'invalidated';
  notes?: string;
  createdAt: any;
}

export interface MembershipPlan {
  id: string;
  creatorId: string;
  creatorName: string;
  name: string;
  tierLevel: number;
  priceInr: number;
  perks: string;
  isActive: boolean;
  createdAt: any;
  updatedAt: any;
}

export interface CreatorMembership {
  id: string;
  planId: string;
  planName: string;
  creatorId: string;
  creatorName: string;
  memberId: string;
  memberName: string;
  priceInr: number;
  status: 'pending' | 'active' | 'cancelled' | 'expired' | 'rejected';
  paymentOrderId?: string;
  paymentVerified: boolean;
  renewsAt?: string;
  createdAt: any;
  updatedAt: any;
}

export interface BrandCampaign {
  id: string;
  brandName: string;
  brandId: string;
  title: string;
  description: string;
  budgetInr: number;
  category: string;
  deliverables: string;
  deadline: string;
  status: 'open' | 'in_progress' | 'completed' | 'closed';
  createdAt: any;
  updatedAt: any;
}

export interface BrandApplication {
  id: string;
  campaignId: string;
  campaignTitle: string;
  brandName: string;
  creatorId: string;
  creatorName: string;
  pitch: string;
  proposedFeeInr: number;
  status: 'applied' | 'shortlisted' | 'approved' | 'delivered' | 'paid' | 'rejected';
  deliverableUrl?: string;
  reviewNotes?: string;
  createdAt: any;
  updatedAt: any;
}

export interface AffiliateLink {
  id: string;
  creatorId: string;
  creatorName: string;
  code: string;
  targetUrl: string;
  productTitle: string;
  merchantName: string;
  commissionPercent: number;
  clicksCount: number;
  validClicksCount: number;
  conversionsCount: number;
  earnedInr: number;
  isActive: boolean;
  createdAt: any;
  updatedAt: any;
}

export interface AffiliateEvent {
  id: string;
  linkId: string;
  code: string;
  creatorId: string;
  eventType: 'click' | 'conversion';
  orderRef?: string;
  saleAmountInr: number;
  commissionInr: number;
  isInvalidTraffic: boolean;
  status: 'recorded' | 'pending' | 'verified' | 'rejected';
  createdAt: any;
}

export interface VideoPurchase {
  id: string;
  videoId: string;
  videoTitle: string;
  creatorId: string;
  creatorName: string;
  buyerId: string;
  buyerName: string;
  amountInr: number;
  creatorNetInr: number;
  platformFeeInr: number;
  paymentOrderId?: string;
  paymentVerified: boolean;
  status: 'pending_verification' | 'verified' | 'rejected' | 'refunded' | 'disputed';
  createdAt: any;
}

export type MonetizationSource =
  | 'ad_revenue'
  | 'membership'
  | 'support'
  | 'brand_connect'
  | 'affiliate'
  | 'paid_video'
  | 'payout'
  | 'adjustment';

export interface MonetizationTransaction {
  id: string;
  creatorId: string;
  counterpartyId?: string;
  counterpartyName?: string;
  source: MonetizationSource;
  grossInr: number;
  platformFeeInr: number;
  netCreatorInr: number;
  status: 'pending' | 'settled' | 'held' | 'disputed' | 'reversed' | 'paid';
  referenceId?: string;
  gatewayVerified: boolean;
  description: string;
  createdAt: any;
}

export interface InvalidTrafficFlag {
  id: string;
  targetType: 'video' | 'affiliate' | 'creator';
  targetId: string;
  creatorId: string;
  creatorName: string;
  signalType: string;
  suspiciousCount: number;
  estimatedImpactInr: number;
  severity: 'low' | 'medium' | 'high';
  status: 'open' | 'confirmed_invalid' | 'cleared';
  notes?: string;
  createdAt: any;
  updatedAt: any;
}

export interface PaymentDispute {
  id: string;
  reporterId: string;
  reporterName: string;
  creatorId: string;
  creatorName: string;
  transactionId: string;
  amountInr: number;
  category: 'unauthorized' | 'undelivered' | 'payout_delay' | 'ad_deduction' | 'brand_milestone';
  reason: string;
  status: 'open' | 'investigating' | 'resolved' | 'refunded' | 'rejected';
  resolutionNote?: string;
  createdAt: any;
  updatedAt: any;
}

export type PaymentMethodOption =
  | 'PhonePe'
  | 'Google Pay'
  | 'Paytm'
  | 'UPI'
  | 'Other UPI Apps';

export type PaymentServiceType =
  | 'paid_video'
  | 'membership'
  | 'support'
  | 'creator_boost_pass'
  | 'platform_service';

export type PaymentVerificationStatus = 'pending_verification' | 'approved' | 'rejected';

export interface PaymentTransaction {
  id: string;
  userId: string;
  userName: string;
  userEmail?: string;
  paymentMethod: PaymentMethodOption;
  amountInr: number;
  utrNumber: string;
  serviceType: PaymentServiceType;
  targetId: string;
  targetTitle: string;
  creatorId: string;
  creatorName: string;
  serviceRecordId?: string;
  note?: string;
  qrCodeImage?: string;
  status: PaymentVerificationStatus;
  serviceActivated: boolean;
  rejectionReason?: string;
  verifiedByUid?: string;
  verifiedByRole?: 'ceo' | 'admin';
  verifiedAt?: string;
  createdAt: any;
  updatedAt: any;
}

export interface GatewayStatusResponse {
  gatewayConfigured: boolean;
  realPaymentsActive: boolean;
  provider: string;
  webhookConfigured: boolean;
  upiQrEnabled?: boolean;
  qrImageUrl?: string;
  supportedPaymentMethods?: PaymentMethodOption[];
}

export interface CreatorEarningsSummary {
  availableBalanceInr: number;
  pendingBalanceInr: number;
  lifetimeEarningsInr: number;
  paidOutTotalInr: number;
  pendingPayoutsTotalInr: number;
  unverifiedEstimateInr: number;
  streams: {
    adRevenueInr: number;
    membershipInr: number;
    supportInr: number;
    brandConnectInr: number;
    affiliateInr: number;
    paidVideoInr: number;
  };
}

export interface CeoAuditLog {
  id: string;
  actorUid: string;
  actorEmail?: string;
  actorRole?: 'ceo' | 'admin';
  action: string;
  targetType:
    | 'user'
    | 'channel'
    | 'video'
    | 'report'
    | 'announcement'
    | 'system'
    | 'admin'
    | 'payout'
    | 'config'
    | 'competition'
    | 'challenge'
    | 'monetization'
    | 'dispute'
    | 'traffic'
    | 'brand'
    | 'payment';
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
  monetizationEnabled?: boolean;
  estimatedEarningsInr?: number;
  availableBalanceInr?: number;
  pendingBalanceInr?: number;
  lifetimeEarningsInr?: number;
  upiId?: string;
  adminPermissions?: AdminPermissions;
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
  totalWatchHours: number;
  activeUsers: number;
  suspendedAccounts: number;
  suspendedChannels: number;
  pendingReports: number;
  liveStreamsActive: number;
  activeChallenges: number;
  activeCompetitions: number;
  totalAdmins: number;
  totalSupportsInr: number;
  totalCreatorEarningsInr: number;
  pendingPayoutsCount: number;
  pendingPayoutsInr: number;
  paidPayoutsInr: number;
}

export interface CeoOverviewResponse {
  metrics: CeoOverviewMetrics;
  users: CeoEnrichedUser[];
  admins: AdminRecord[];
  videos: VideoItem[];
  reports: ModerationReport[];
  announcements: PlatformAnnouncement[];
  payouts: CreatorPayout[];
  supports: CreatorSupport[];
  platformConfig: PlatformConfig;
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
  | 'payments'
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
