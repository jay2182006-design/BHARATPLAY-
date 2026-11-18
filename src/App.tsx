import React, { useEffect, useMemo, useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { WebSocketProvider, useWebSocket } from './contexts/WebSocketContext';
import { ToastProvider, useToast } from './components/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LayoutShell } from './components/LayoutShell';
import { UploadModal } from './components/UploadModal';
import { HomePage } from './pages/HomePage';
import { WatchPage } from './pages/WatchPage';
import { ShortsPage } from './pages/ShortsPage';
import { LivePage } from './pages/LivePage';
import { ExploreAndSearchPage } from './pages/ExploreAndSearchPage';
import { SubscriptionsPage } from './pages/SubscriptionsPage';
import { ChannelProfilePage } from './pages/ChannelProfilePage';
import { CreatorStudioPage } from './pages/CreatorStudioPage';
import { AuthPages } from './pages/AuthPages';
import { SettingsPage } from './pages/SettingsPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { CeoCommandCenterPage } from './pages/CeoCommandCenterPage';
import { InfoPages } from './pages/InfoPages';
import { CreatorBoostPage } from './pages/CreatorBoostPage';
import { CreatorLeaguePage } from './pages/CreatorLeaguePage';
import { WatchPartyPage } from './pages/WatchPartyPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { LibraryPage } from './pages/LibraryPage';
import { PaymentsPage } from './pages/PaymentsPage';
import {
  subscribeAcceptedCollaborations,
  subscribeAnnouncements,
  subscribeChallenges,
  subscribeCommunityPosts,
  subscribeCompetitions,
  subscribeCreators,
  subscribeLiveStreams,
  subscribePlatformConfig,
  subscribePublishedVideos,
  subscribeUserCollaborations,
  subscribeUserNotifications,
  subscribeUserPlaylists,
  subscribeUserSubscriptions,
  subscribeWatchHistory,
  subscribeWatchLater,
  subscribeWatchParties,
  toggleWatchLater,
} from './lib/bharatplayService';
import { DEFAULT_PLATFORM_CONFIG } from './lib/catalogSeed';
import type {
  AppRoute,
  CollaborationRequest,
  CommunityPost,
  CreatorChallenge,
  LeagueCompetition,
  LiveStream,
  PlatformAnnouncement,
  PlatformConfig,
  Playlist,
  Subscription,
  UserNotification,
  UserPublicProfile,
  VideoItem,
  WatchHistoryItem,
  WatchLaterItem,
  WatchPartyRoom,
} from './types/bharatplay';

function BharatPlayShell() {
  const { user, profile, isSuspended } = useAuth();
  const { recentStreamAlerts } = useWebSocket();
  const { showToast } = useToast();

  const [route, setRoute] = useState<AppRoute>('home');
  const [routeParam, setRouteParam] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadDefaultType, setUploadDefaultType] = useState<'video' | 'short'>('video');

  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [videosLoading, setVideosLoading] = useState(true);
  const [creators, setCreators] = useState<UserPublicProfile[]>([]);
  const [liveStreams, setLiveStreams] = useState<LiveStream[]>([]);
  const [communityPosts, setCommunityPosts] = useState<CommunityPost[]>([]);
  const [challenges, setChallenges] = useState<CreatorChallenge[]>([]);
  const [competitions, setCompetitions] = useState<LeagueCompetition[]>([]);
  const [announcements, setAnnouncements] = useState<PlatformAnnouncement[]>([]);
  const [acceptedCollaborations, setAcceptedCollaborations] = useState<CollaborationRequest[]>([]);
  const [watchParties, setWatchParties] = useState<WatchPartyRoom[]>([]);
  const [platformConfig, setPlatformConfig] = useState<PlatformConfig>({
    ...DEFAULT_PLATFORM_CONFIG,
    updatedAt: new Date(),
  });

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [watchHistory, setWatchHistory] = useState<WatchHistoryItem[]>([]);
  const [watchLater, setWatchLater] = useState<WatchLaterItem[]>([]);
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [userCollaborations, setUserCollaborations] = useState<CollaborationRequest[]>([]);

  // Public Catalog Subscriptions
  useEffect(() => {
    const u1 = subscribePublishedVideos((items) => {
      setVideos(items);
      setVideosLoading(false);
    });
    const u2 = subscribeCreators(setCreators);
    const u3 = subscribeLiveStreams(setLiveStreams);
    const u4 = subscribeCommunityPosts(setCommunityPosts);
    const u5 = subscribeChallenges(setChallenges);
    const u6 = subscribePlatformConfig(setPlatformConfig);
    const u7 = subscribeAcceptedCollaborations(setAcceptedCollaborations);
    const u8 = subscribeCompetitions(setCompetitions);
    const u9 = subscribeAnnouncements(setAnnouncements);
    return () => {
      u1();
      u2();
      u3();
      u4();
      u5();
      u6();
      u7();
      u8();
      u9();
    };
  }, []);

  // Watch Parties Subscription (includes public rooms + user's hosted rooms)
  useEffect(() => {
    return subscribeWatchParties(user?.uid, setWatchParties);
  }, [user?.uid]);

  // User-Scoped Subscriptions
  useEffect(() => {
    if (!user?.uid) {
      setSubscriptions([]);
      setPlaylists([]);
      setWatchHistory([]);
      setWatchLater([]);
      setNotifications([]);
      setUserCollaborations([]);
      return;
    }
    const u1 = subscribeUserSubscriptions(user.uid, setSubscriptions);
    const u2 = subscribeUserPlaylists(user.uid, setPlaylists);
    const u3 = subscribeWatchHistory(user.uid, setWatchHistory);
    const u4 = subscribeWatchLater(user.uid, setWatchLater);
    const u5 = subscribeUserNotifications(user.uid, setNotifications);
    const u6 = subscribeUserCollaborations(user.uid, setUserCollaborations);
    return () => {
      u1();
      u2();
      u3();
      u4();
      u5();
      u6();
    };
  }, [user?.uid]);

  // URL Deep-Linking Support
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const w = params.get('watch');
    const s = params.get('short');
    const l = params.get('live');
    const c = params.get('channel');
    const p = params.get('party');
    const ceo = params.get('ceo');
    if (ceo) {
      setRoute('ceo-command');
    } else if (w) {
      setRoute('watch');
      setRouteParam(w);
    } else if (s) {
      setRoute('shorts');
      setRouteParam(s);
    } else if (l) {
      setRoute('live');
      setRouteParam(l);
    } else if (c) {
      setRoute('channel');
      setRouteParam(c);
    } else if (p) {
      setRoute('watch-party');
      setRouteParam(p);
    } else if (params.get('payments')) {
      setRoute('payments');
    }
  }, []);

  // Live Stream WebSocket Alert Toast
  useEffect(() => {
    if (recentStreamAlerts.length > 0) {
      const latest = recentStreamAlerts[0];
      if (latest.creatorId !== user?.uid) {
        showToast(`${latest.creatorName} just went LIVE: ${latest.title}`, 'info');
      }
    }
  }, [recentStreamAlerts, showToast, user?.uid]);

  const navigate = (nextRoute: AppRoute, param = '') => {
    setRoute(nextRoute);
    setRouteParam(param);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenUpload = (type: 'video' | 'short' = 'video') => {
    if (!user) {
      showToast('Sign in to publish videos or Bharat Shorts.', 'info');
      navigate('login');
      return;
    }
    if (isSuspended) {
      showToast('Account suspended: publishing videos or Shorts is disabled.', 'error');
      return;
    }
    setUploadDefaultType(type);
    setUploadOpen(true);
  };

  const handleToggleWatchLater = async (video: VideoItem) => {
    if (!user) {
      showToast('Sign in to save videos to Watch Later.', 'info');
      navigate('login');
      return;
    }
    const isSaved = watchLater.some((w) => w.videoId === video.id);
    try {
      const next = await toggleWatchLater(user.uid, video, isSaved);
      showToast(next ? 'Saved to Watch Later' : 'Removed from Watch Later', 'success');
    } catch {
      showToast('Unable to update Watch Later right now.', 'error');
    }
  };

  const shortsList = useMemo(() => videos.filter((v) => v.type === 'short'), [videos]);

  const currentWatchVideo = useMemo(() => {
    if (route !== 'watch') return null;
    return videos.find((v) => v.id === routeParam) || videos.find((v) => v.type === 'video') || videos[0] || null;
  }, [route, routeParam, videos]);

  const handleWatchVideo = (video: VideoItem) => {
    if (video.type === 'short') {
      navigate('shorts', video.id);
    } else {
      navigate('watch', video.id);
    }
  };

  return (
    <LayoutShell
      route={route}
      onNavigate={navigate}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      onSearchSubmit={() => navigate('search')}
      onOpenUpload={() => handleOpenUpload('video')}
      videos={videos}
      creators={creators}
      notifications={notifications}
      announcements={announcements}
    >
      {route === 'home' && (
        <HomePage
          videos={videos}
          creators={creators}
          liveStreams={liveStreams}
          watchHistory={watchHistory}
          watchLater={watchLater}
          platformConfig={platformConfig}
          preferredLanguage={profile?.preferredLanguage}
          loading={videosLoading}
          onWatchVideo={handleWatchVideo}
          onToggleWatchLater={handleToggleWatchLater}
          onOpenChannel={(cid) => navigate('channel', cid)}
          onNavigate={navigate}
        />
      )}

      {route === 'watch' && currentWatchVideo && (
        <WatchPage
          video={currentWatchVideo}
          allVideos={videos}
          creators={creators}
          subscriptions={subscriptions}
          playlists={playlists}
          watchHistory={watchHistory}
          watchLater={watchLater}
          onWatchVideo={handleWatchVideo}
          onOpenChannel={(cid) => navigate('channel', cid)}
          onNavigate={navigate}
        />
      )}

      {route === 'shorts' && (
        <ShortsPage
          shorts={shortsList}
          initialShortId={routeParam}
          subscriptions={subscriptions}
          onOpenUploadShort={() => handleOpenUpload('short')}
          onOpenChannel={(cid) => navigate('channel', cid)}
          onNavigate={navigate}
        />
      )}

      {route === 'live' && (
        <LivePage
          streams={liveStreams}
          selectedStreamId={routeParam}
          subscriptions={subscriptions}
          onSelectStream={(sid) => setRouteParam(sid)}
          onOpenChannel={(cid) => navigate('channel', cid)}
          onNavigate={navigate}
        />
      )}

      {(route === 'explore' || route === 'search') && (
        <ExploreAndSearchPage
          mode={route}
          searchQuery={searchQuery}
          videos={videos}
          creators={creators}
          challenges={challenges}
          communityPosts={communityPosts}
          platformConfig={platformConfig}
          watchLater={watchLater}
          onWatchVideo={handleWatchVideo}
          onToggleWatchLater={handleToggleWatchLater}
          onOpenChannel={(cid) => navigate('channel', cid)}
          onOpenUploadForChallenge={() => handleOpenUpload('short')}
          onNavigate={navigate}
        />
      )}

      {route === 'subscriptions' && (
        <SubscriptionsPage
          subscriptions={subscriptions}
          videos={videos}
          creators={creators}
          watchLater={watchLater}
          onWatchVideo={handleWatchVideo}
          onToggleWatchLater={handleToggleWatchLater}
          onOpenChannel={(cid) => navigate('channel', cid)}
          onNavigate={navigate}
        />
      )}

      {route === 'boost' && (
        <CreatorBoostPage
          creators={creators}
          videos={videos}
          watchLater={watchLater}
          onWatchVideo={handleWatchVideo}
          onToggleWatchLater={handleToggleWatchLater}
          onOpenChannel={(cid) => navigate('channel', cid)}
          onNavigate={navigate}
        />
      )}

      {route === 'league' && (
        <CreatorLeaguePage
          creators={creators}
          videos={videos}
          competitions={competitions}
          onOpenChannel={(cid) => navigate('channel', cid)}
        />
      )}

      {route === 'watch-party' && (
        <WatchPartyPage
          videos={videos}
          watchParties={watchParties}
          initialRoomId={routeParam}
          onNavigate={navigate}
        />
      )}

      {route === 'notifications' && (
        <NotificationsPage
          notifications={notifications}
          announcements={announcements}
          onNavigate={navigate}
        />
      )}

      {(route === 'watch-later' || route === 'history') && (
        <LibraryPage
          mode={route}
          videos={videos}
          creators={creators}
          watchLater={watchLater}
          watchHistory={watchHistory}
          onWatchVideo={handleWatchVideo}
          onToggleWatchLater={handleToggleWatchLater}
          onOpenChannel={(cid) => navigate('channel', cid)}
          onNavigate={navigate}
        />
      )}

      {route === 'channel' && (
        <ChannelProfilePage
          channelId={routeParam || user?.uid || ''}
          creators={creators}
          videos={videos}
          communityPosts={communityPosts}
          subscriptions={subscriptions}
          userPlaylists={playlists}
          acceptedCollaborations={acceptedCollaborations}
          watchLater={watchLater}
          onWatchVideo={handleWatchVideo}
          onToggleWatchLater={handleToggleWatchLater}
          onOpenShort={(sid) => navigate('shorts', sid)}
          onOpenChannel={(cid) => navigate('channel', cid)}
          onNavigate={navigate}
        />
      )}

      {route === 'studio' && (
        <CreatorStudioPage
          videos={videos}
          liveStreams={liveStreams}
          playlists={playlists}
          communityPosts={communityPosts}
          collaborations={userCollaborations}
          platformConfig={platformConfig}
          onOpenUpload={() => handleOpenUpload('video')}
          onNavigate={navigate}
        />
      )}

      {(route === 'login' || route === 'signup') && (
        <AuthPages mode={route} onNavigate={navigate} />
      )}

      {route === 'settings' && <SettingsPage onNavigate={navigate} />}

      {route === 'payments' && (
        <PaymentsPage videos={videos} onWatchVideo={handleWatchVideo} onNavigate={navigate} />
      )}

      {route === 'admin' && (
        <AdminDashboardPage
          creators={creators}
          challenges={challenges}
          competitions={competitions}
          platformConfig={platformConfig}
          onNavigate={navigate}
        />
      )}

      {route === 'ceo-command' && (
        <CeoCommandCenterPage
          onOpenChannel={(cid) => navigate('channel', cid)}
          onWatchVideo={handleWatchVideo}
          onNavigate={navigate}
        />
      )}

      {(route === 'about' || route === 'contact' || route === 'privacy' || route === 'terms') && (
        <InfoPages page={route} onNavigate={navigate} />
      )}

      <UploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        defaultType={uploadDefaultType}
        challenges={challenges}
        onPublished={(vidId, type) => {
          navigate(type === 'short' ? 'shorts' : 'watch', vidId);
        }}
      />
    </LayoutShell>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ThemeProvider>
          <WebSocketProvider>
            <ToastProvider>
              <BharatPlayShell />
            </ToastProvider>
          </WebSocketProvider>
        </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
