import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  DEFAULT_PLATFORM_CONFIG,
  SEED_ANNOUNCEMENTS,
  SEED_CHALLENGES,
  SEED_COMMUNITY_POSTS,
  SEED_COMPETITIONS,
  SEED_CREATORS,
  SEED_LIVE_STREAMS,
  SEED_VIDEOS,
} from './catalogSeed';
import {
  VALIDATION_LIMITS,
  type CollaborationRequest,
  type CommunityPost,
  type CreatorChallenge,
  type LeagueCompetition,
  type LiveChatMessage,
  type LiveStream,
  type ModerationReport,
  type NotificationType,
  type PlatformAnnouncement,
  type PlatformConfig,
  type Playlist,
  type Subscription,
  type UserNotification,
  type UserPublicProfile,
  type VideoChapter,
  type VideoComment,
  type VideoItem,
  type WatchHistoryItem,
  type WatchLaterItem,
  type WatchPartyMessage,
  type WatchPartyRoom,
} from '../types/bharatplay';

const newDocId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

// --- Media Storage Upload Helpers (Express /api/upload/*) ---
export function uploadVideoWithProgress(
  file: File,
  token: string,
  onProgress: (pct: number) => void
): Promise<{ url: string; filename: string; size: number }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload/video');
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) {
        onProgress(Math.round((ev.loaded / ev.total) * 100));
      }
    };

    xhr.onload = () => {
      try {
        const json = JSON.parse(xhr.responseText || '{}');
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(json);
        } else {
          reject(new Error(json.error || `Upload failed (${xhr.status})`));
        }
      } catch {
        reject(new Error('Invalid upload server response'));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during video upload'));

    const formData = new FormData();
    formData.append('video', file);
    xhr.send(formData);
  });
}

export async function uploadImageAsset(
  file: File,
  kind: 'thumbnail' | 'avatar',
  token: string
): Promise<string> {
  const formData = new FormData();
  formData.append('image', file);
  const res = await fetch(`/api/upload/image?kind=${kind}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || 'Image upload failed');
  }
  return json.url;
}

// --- Notifications Helper ---
export async function sendUserNotification(params: {
  recipientId: string;
  senderName?: string;
  type: NotificationType;
  title: string;
  message: string;
  linkPath?: string;
}) {
  if (!params.recipientId) return;
  const notifId = newDocId('ntf');
  try {
    await setDoc(doc(db, 'notifications', notifId), {
      recipientId: params.recipientId,
      senderName: (params.senderName || 'BHARATPLAY').slice(0, VALIDATION_LIMITS.DISPLAY_NAME_MAX),
      type: params.type,
      title: params.title.slice(0, 120),
      message: params.message.slice(0, 300),
      linkPath: (params.linkPath || '').slice(0, 200),
      isRead: false,
      createdAt: serverTimestamp(),
    });
  } catch {
    // non-fatal if triggered before creator doc exists
  }
}

// --- Real-Time Catalog Subscriptions ---
export function subscribePublishedVideos(cb: (videos: VideoItem[]) => void) {
  const q = query(collection(db, 'videos'), where('status', '==', 'published'));
  return onSnapshot(
    q,
    (snap) => {
      const live = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<VideoItem, 'id'>) }));
      if (live.length === 0) {
        const fallback = SEED_VIDEOS.map((v, idx) => ({
          ...v,
          createdAt: new Date(Date.now() - 3600_000 * (idx + 2)),
          updatedAt: new Date(),
        })) as VideoItem[];
        cb(fallback);
        return;
      }
      live.sort((a, b) => {
        const ta = a.createdAt?.seconds || 0;
        const tb = b.createdAt?.seconds || 0;
        return tb - ta;
      });
      cb(live);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, 'videos');
    }
  );
}

export function subscribeAllVideosAdmin(cb: (videos: VideoItem[]) => void) {
  return onSnapshot(
    collection(db, 'videos'),
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<VideoItem, 'id'>) }));
      items.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      cb(items);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'videos')
  );
}

export function subscribeCreators(cb: (creators: UserPublicProfile[]) => void) {
  const q = query(collection(db, 'users'), where('isCreator', '==', true));
  return onSnapshot(
    q,
    (snap) => {
      const docs = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as UserPublicProfile) }))
        .filter(
          (c) =>
            c.accountStatus !== 'suspended' &&
            c.accountStatus !== 'deleted' &&
            c.channelStatus !== 'suspended' &&
            c.channelStatus !== 'deleted'
        );
      if (docs.length === 0) {
        cb(
          SEED_CREATORS.map((c) => ({
            ...c,
            createdAt: new Date(Date.now() - 86400_000 * 14),
            updatedAt: new Date(),
          }))
        );
        return;
      }
      cb(docs);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'users')
  );
}

export function subscribeAllUsersAdmin(cb: (users: UserPublicProfile[]) => void) {
  return onSnapshot(
    collection(db, 'users'),
    (snap) => {
      cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as UserPublicProfile) })));
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'users')
  );
}

export function subscribeLiveStreams(cb: (streams: LiveStream[]) => void) {
  const q = query(collection(db, 'liveStreams'), where('isLive', '==', true));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<LiveStream, 'id'>) }));
      if (items.length === 0) {
        cb(SEED_LIVE_STREAMS.map((s) => ({ ...s, startedAt: new Date() })));
        return;
      }
      items.sort((a, b) => Number(b.isLive) - Number(a.isLive));
      cb(items);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'liveStreams')
  );
}

export function subscribeCommunityPosts(cb: (posts: CommunityPost[]) => void) {
  const q = query(
    collection(db, 'communityPosts'),
    where('postType', 'in', ['text', 'image', 'poll', 'announcement'])
  );
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CommunityPost, 'id'>) }));
      if (items.length === 0) {
        cb(SEED_COMMUNITY_POSTS.map((p) => ({ ...p, createdAt: new Date() })));
        return;
      }
      items.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      cb(items);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'communityPosts')
  );
}

export function subscribeChallenges(cb: (challenges: CreatorChallenge[]) => void) {
  const q = query(collection(db, 'challenges'), where('status', 'in', ['active', 'ended']));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CreatorChallenge, 'id'>) }));
      if (items.length === 0) {
        cb(SEED_CHALLENGES.map((c) => ({ ...c, createdAt: new Date() })));
        return;
      }
      cb(items);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'challenges')
  );
}

export function subscribeCompetitions(cb: (items: LeagueCompetition[]) => void) {
  const q = query(collection(db, 'competitions'), where('status', 'in', ['active', 'completed']));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<LeagueCompetition, 'id'>) }));
      if (items.length === 0) {
        cb(SEED_COMPETITIONS.map((c) => ({ ...c, createdAt: new Date() })));
        return;
      }
      items.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      cb(items);
    },
    () => cb(SEED_COMPETITIONS.map((c) => ({ ...c, createdAt: new Date() })))
  );
}

export function subscribeAnnouncements(cb: (items: PlatformAnnouncement[]) => void, includeInactive = false) {
  const q = includeInactive
    ? collection(db, 'announcements')
    : query(collection(db, 'announcements'), where('isActive', '==', true));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PlatformAnnouncement, 'id'>) }));
      if (items.length === 0 && !includeInactive) {
        cb(SEED_ANNOUNCEMENTS.map((a) => ({ ...a, createdAt: new Date() })));
        return;
      }
      items.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      cb(items);
    },
    () => cb(SEED_ANNOUNCEMENTS.map((a) => ({ ...a, createdAt: new Date() })))
  );
}

export function subscribePlatformConfig(cb: (cfg: PlatformConfig) => void) {
  return onSnapshot(
    doc(db, 'platformConfig', 'settings'),
    (snap) => {
      if (snap.exists()) {
        cb(snap.data() as PlatformConfig);
      } else {
        cb({ ...DEFAULT_PLATFORM_CONFIG, updatedAt: new Date() });
      }
    },
    (err) => handleFirestoreError(err, OperationType.GET, 'platformConfig/settings')
  );
}

export function subscribeVideoComments(videoId: string, cb: (comments: VideoComment[]) => void) {
  const q = query(
    collection(db, 'videos', videoId, 'comments'),
    where('videoId', '==', videoId),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(
    q,
    (snap) => {
      cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<VideoComment, 'id'>) })));
    },
    () => {
      cb([]);
    }
  );
}

export function subscribeUserSubscriptions(uid: string, cb: (subs: Subscription[]) => void) {
  const q = query(collection(db, 'subscriptions'), where('subscriberId', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Subscription, 'id'>) })));
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'subscriptions')
  );
}

export function subscribeUserPlaylists(uid: string, cb: (playlists: Playlist[]) => void) {
  const q = query(collection(db, 'playlists'), where('ownerId', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Playlist, 'id'>) })));
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'playlists')
  );
}

export function subscribePublicPlaylistsByCreator(creatorId: string, cb: (playlists: Playlist[]) => void) {
  const q = query(
    collection(db, 'playlists'),
    where('ownerId', '==', creatorId),
    where('visibility', '==', 'public')
  );
  return onSnapshot(
    q,
    (snap) => {
      cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Playlist, 'id'>) })));
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'playlists')
  );
}

export function subscribeWatchHistory(uid: string, cb: (items: WatchHistoryItem[]) => void) {
  const q = query(collection(db, 'users', uid, 'watchHistory'), where('userId', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<WatchHistoryItem, 'id'>) }));
      list.sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
      cb(list);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, `users/${uid}/watchHistory`)
  );
}

export function subscribeWatchLater(uid: string, cb: (items: WatchLaterItem[]) => void) {
  const q = query(collection(db, 'users', uid, 'watchLater'), where('userId', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<WatchLaterItem, 'id'>) }));
      list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      cb(list);
    },
    () => cb([])
  );
}

export function subscribeUserNotifications(uid: string, cb: (items: UserNotification[]) => void) {
  const q = query(collection(db, 'notifications'), where('recipientId', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<UserNotification, 'id'>) }));
      list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      cb(list);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'notifications')
  );
}

export function subscribeLiveChat(streamId: string, cb: (messages: LiveChatMessage[]) => void) {
  const q = query(
    collection(db, 'liveStreams', streamId, 'messages'),
    where('streamId', '==', streamId),
    orderBy('createdAt', 'asc')
  );
  return onSnapshot(
    q,
    (snap) => {
      cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<LiveChatMessage, 'id'>) })));
    },
    () => cb([])
  );
}

export function subscribeReportsAdmin(cb: (reports: ModerationReport[]) => void) {
  return onSnapshot(
    collection(db, 'reports'),
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ModerationReport, 'id'>) }));
      list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      cb(list);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'reports')
  );
}

// --- Collaborations Subscriptions & Mutations ---
export function subscribeAcceptedCollaborations(cb: (items: CollaborationRequest[]) => void) {
  const q = query(collection(db, 'collaborations'), where('status', '==', 'accepted'));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CollaborationRequest, 'id'>) }));
      list.sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
      cb(list);
    },
    () => cb([])
  );
}

export function subscribeUserCollaborations(uid: string, cb: (items: CollaborationRequest[]) => void) {
  const qIn = query(collection(db, 'collaborations'), where('recipientId', '==', uid));
  const qOut = query(collection(db, 'collaborations'), where('senderId', '==', uid));
  let incoming: CollaborationRequest[] = [];
  let outgoing: CollaborationRequest[] = [];

  const emit = () => {
    const map = new Map<string, CollaborationRequest>();
    for (const item of [...incoming, ...outgoing]) map.set(item.id, item);
    const merged = Array.from(map.values());
    merged.sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
    cb(merged);
  };

  const u1 = onSnapshot(qIn, (snap) => {
    incoming = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CollaborationRequest, 'id'>) }));
    emit();
  }, () => {});
  const u2 = onSnapshot(qOut, (snap) => {
    outgoing = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CollaborationRequest, 'id'>) }));
    emit();
  }, () => {});

  return () => {
    u1();
    u2();
  };
}

export async function sendCollaborationRequest(params: {
  sender: UserPublicProfile;
  recipient: UserPublicProfile;
  title: string;
  proposal: string;
}) {
  const collabId = newDocId('col');
  try {
    await setDoc(doc(db, 'collaborations', collabId), {
      senderId: params.sender.uid,
      senderName: params.sender.displayName.slice(0, VALIDATION_LIMITS.DISPLAY_NAME_MAX),
      senderAvatar: params.sender.avatarUrl || '',
      recipientId: params.recipient.uid,
      recipientName: params.recipient.displayName.slice(0, VALIDATION_LIMITS.DISPLAY_NAME_MAX),
      recipientAvatar: params.recipient.avatarUrl || '',
      title: params.title.trim().slice(0, 120),
      proposal: params.proposal.trim().slice(0, 800),
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await sendUserNotification({
      recipientId: params.recipient.uid,
      senderName: params.sender.displayName,
      type: 'collaboration',
      title: `Collaboration Invite from ${params.sender.displayName}`,
      message: params.title.trim().slice(0, 120),
      linkPath: '/studio',
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `collaborations/${collabId}`);
  }
}

export async function respondCollaborationRequest(
  collab: CollaborationRequest,
  status: 'accepted' | 'rejected'
) {
  try {
    await updateDoc(doc(db, 'collaborations', collab.id), {
      status,
      updatedAt: serverTimestamp(),
    });
    await sendUserNotification({
      recipientId: collab.senderId,
      senderName: collab.recipientName,
      type: 'collaboration',
      title: status === 'accepted'
        ? `${collab.recipientName} accepted your collaboration!`
        : `${collab.recipientName} declined your collaboration request`,
      message: collab.title,
      linkPath: `/channel/${collab.recipientId}`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `collaborations/${collab.id}`);
  }
}

// --- Watch Party Subscriptions & Mutations ---
export function subscribeWatchParties(uid: string | undefined, cb: (rooms: WatchPartyRoom[]) => void) {
  const qPub = query(collection(db, 'watchParties'), where('isPrivate', '==', false));
  let pubRooms: WatchPartyRoom[] = [];
  let myRooms: WatchPartyRoom[] = [];

  const emit = () => {
    const map = new Map<string, WatchPartyRoom>();
    for (const r of [...pubRooms, ...myRooms]) {
      if (r.status === 'active') map.set(r.id, r);
    }
    const list = Array.from(map.values());
    list.sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
    cb(list);
  };

  const u1 = onSnapshot(qPub, (snap) => {
    pubRooms = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<WatchPartyRoom, 'id'>) }));
    emit();
  }, () => {});

  let u2 = () => {};
  if (uid) {
    const qMine = query(collection(db, 'watchParties'), where('hostId', '==', uid));
    u2 = onSnapshot(qMine, (snap) => {
      myRooms = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<WatchPartyRoom, 'id'>) }));
      emit();
    }, () => {});
  }

  return () => {
    u1();
    u2();
  };
}

export async function getWatchPartyById(roomId: string): Promise<WatchPartyRoom | null> {
  try {
    const snap = await getDoc(doc(db, 'watchParties', roomId.trim()));
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as Omit<WatchPartyRoom, 'id'>) };
  } catch {
    return null;
  }
}

export function subscribeWatchPartyRoom(roomId: string, cb: (room: WatchPartyRoom | null) => void) {
  return onSnapshot(
    doc(db, 'watchParties', roomId),
    (snap) => {
      if (snap.exists()) cb({ id: snap.id, ...(snap.data() as Omit<WatchPartyRoom, 'id'>) });
      else cb(null);
    },
    () => cb(null)
  );
}

export function subscribeWatchPartyMessages(roomId: string, cb: (msgs: WatchPartyMessage[]) => void) {
  const q = query(
    collection(db, 'watchParties', roomId, 'messages'),
    where('roomId', '==', roomId),
    orderBy('createdAt', 'asc')
  );
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<WatchPartyMessage, 'id'>) }))),
    () => cb([])
  );
}

export async function createWatchParty(params: {
  host: UserPublicProfile;
  title: string;
  video: VideoItem;
  isPrivate: boolean;
}): Promise<WatchPartyRoom> {
  const roomId = `wp_${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const inviteCode = roomId.replace('wp_', 'BP-');
  const payload = {
    hostId: params.host.uid,
    hostName: params.host.displayName.slice(0, VALIDATION_LIMITS.DISPLAY_NAME_MAX),
    title: params.title.trim().slice(0, 120),
    videoId: params.video.id,
    videoTitle: params.video.title.slice(0, VALIDATION_LIMITS.VIDEO_TITLE_MAX),
    videoUrl: params.video.videoUrl,
    thumbnailUrl: params.video.thumbnailUrl || '',
    inviteCode,
    isPrivate: params.isPrivate,
    isPlaying: false,
    currentTimeSeconds: 0,
    status: 'active' as const,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  try {
    await setDoc(doc(db, 'watchParties', roomId), payload);
    return {
      id: roomId,
      ...payload,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `watchParties/${roomId}`);
  }
}

export async function updateWatchPartyState(
  roomId: string,
  updates: Partial<Pick<WatchPartyRoom, 'isPlaying' | 'currentTimeSeconds' | 'videoId' | 'videoTitle' | 'videoUrl' | 'thumbnailUrl' | 'status'>>
) {
  try {
    await updateDoc(doc(db, 'watchParties', roomId), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch {
    // non-fatal sync update
  }
}

export async function sendWatchPartyMessage(
  roomId: string,
  sender: UserPublicProfile,
  text: string
): Promise<WatchPartyMessage> {
  const messageId = newDocId('wpmsg');
  const payload = {
    roomId,
    senderId: sender.uid,
    senderName: sender.displayName.slice(0, VALIDATION_LIMITS.DISPLAY_NAME_MAX),
    senderAvatar: sender.avatarUrl || '',
    text: text.trim().slice(0, VALIDATION_LIMITS.CHAT_MSG_MAX),
    createdAt: serverTimestamp(),
  };
  try {
    await setDoc(doc(db, 'watchParties', roomId, 'messages', messageId), payload);
    return { id: messageId, ...payload, createdAt: new Date() };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `watchParties/${roomId}/messages/${messageId}`);
  }
}

// --- Video & Short Actions ---
export async function publishVideo(params: {
  creator: UserPublicProfile;
  title: string;
  description: string;
  videoUrl: string;
  thumbnailUrl: string;
  type: 'video' | 'short';
  category: string;
  language: string;
  durationSeconds: number;
  musicTrack?: string;
  challengeId?: string;
  tags: string[];
  chapters?: VideoChapter[];
}): Promise<string> {
  const videoId = newDocId(params.type === 'short' ? 'short' : 'vid');
  const cleanTags = params.tags
    .map((t) => t.trim().slice(0, 32))
    .filter(Boolean)
    .slice(0, VALIDATION_LIMITS.TAGS_MAX);
  const cleanChapters = (params.chapters || [])
    .filter((c) => c.title.trim().length > 0 && c.timeSeconds >= 0)
    .slice(0, VALIDATION_LIMITS.CHAPTERS_MAX)
    .map((c) => ({ timeSeconds: Math.round(c.timeSeconds), title: c.title.trim().slice(0, 80) }))
    .sort((a, b) => a.timeSeconds - b.timeSeconds);

  try {
    await setDoc(doc(db, 'videos', videoId), {
      creatorId: params.creator.uid,
      creatorName: params.creator.displayName.slice(0, VALIDATION_LIMITS.DISPLAY_NAME_MAX),
      creatorAvatar: params.creator.avatarUrl || '',
      title: params.title.trim().slice(0, VALIDATION_LIMITS.VIDEO_TITLE_MAX),
      description: params.description.trim().slice(0, VALIDATION_LIMITS.VIDEO_DESC_MAX),
      videoUrl: params.videoUrl,
      thumbnailUrl: params.thumbnailUrl || '/src/assets/images/thumb_tech_india_1794912701310.jpg',
      type: params.type,
      category: params.category,
      language: params.language,
      durationSeconds: Math.max(1, Math.round(params.durationSeconds || 10)),
      musicTrack: (params.musicTrack || '').slice(0, 120),
      challengeId: (params.challengeId || '').slice(0, 128),
      tags: cleanTags,
      chapters: cleanChapters,
      viewsCount: 0,
      uniqueViewersCount: 0,
      totalWatchSeconds: 0,
      likesCount: 0,
      dislikesCount: 0,
      commentsCount: 0,
      sharesCount: 0,
      status: 'published',
      isTrending: false,
      isEarlyCreatorSpotlight: Boolean(params.creator.isEarlyCreator),
      isOriginal: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (params.challengeId) {
      await updateDoc(doc(db, 'challenges', params.challengeId), {
        participantsCount: increment(1),
      }).catch(() => {});
    }

    return videoId;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `videos/${videoId}`);
  }
}

export async function updateVideoMetadata(
  videoId: string,
  updates: {
    title: string;
    description: string;
    category: string;
    language: string;
    chapters?: VideoChapter[];
  }
) {
  try {
    await updateDoc(doc(db, 'videos', videoId), {
      title: updates.title.trim().slice(0, VALIDATION_LIMITS.VIDEO_TITLE_MAX),
      description: updates.description.trim().slice(0, VALIDATION_LIMITS.VIDEO_DESC_MAX),
      category: updates.category,
      language: updates.language,
      ...(updates.chapters ? { chapters: updates.chapters.slice(0, VALIDATION_LIMITS.CHAPTERS_MAX) } : {}),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `videos/${videoId}`);
  }
}

export async function deleteVideoDoc(videoId: string) {
  try {
    await deleteDoc(doc(db, 'videos', videoId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `videos/${videoId}`);
  }
}

const sessionViewedVideos = new Set<string>();

export async function recordVideoView(videoId: string, creatorId: string) {
  try {
    const vidRef = doc(db, 'videos', videoId);
    const snap = await getDoc(vidRef);
    if (!snap.exists()) return;
    const isUnique = !sessionViewedVideos.has(videoId);
    sessionViewedVideos.add(videoId);
    await updateDoc(vidRef, {
      viewsCount: increment(1),
      ...(isUnique ? { uniqueViewersCount: increment(1) } : {}),
      updatedAt: serverTimestamp(),
    });
    const creatorRef = doc(db, 'users', creatorId);
    const creatorSnap = await getDoc(creatorRef);
    if (creatorSnap.exists()) {
      await updateDoc(creatorRef, {
        totalViews: increment(1),
        updatedAt: serverTimestamp(),
      });
    }
  } catch {
    // non-fatal if unauthenticated viewer
  }
}

export async function recordVideoShare(videoId: string) {
  try {
    const vidRef = doc(db, 'videos', videoId);
    const snap = await getDoc(vidRef);
    if (!snap.exists()) return;
    await updateDoc(vidRef, {
      sharesCount: increment(1),
      updatedAt: serverTimestamp(),
    });
  } catch {
    // non-fatal
  }
}

export async function getUserVideoReaction(videoId: string, userId: string): Promise<'like' | 'dislike' | null> {
  try {
    const snap = await getDoc(doc(db, 'videos', videoId, 'reactions', userId));
    if (!snap.exists()) return null;
    return snap.data()?.type || null;
  } catch {
    return null;
  }
}

export async function toggleVideoReaction(
  videoId: string,
  userId: string,
  nextType: 'like' | 'dislike',
  prevType: 'like' | 'dislike' | null,
  notifyContext?: { creatorId: string; actorName: string; videoTitle: string }
): Promise<'like' | 'dislike' | null> {
  const reactRef = doc(db, 'videos', videoId, 'reactions', userId);
  const videoRef = doc(db, 'videos', videoId);
  try {
    if (prevType === nextType) {
      await deleteDoc(reactRef);
      await updateDoc(videoRef, {
        [nextType === 'like' ? 'likesCount' : 'dislikesCount']: increment(-1),
        updatedAt: serverTimestamp(),
      });
      return null;
    }

    if (prevType === null) {
      await setDoc(reactRef, {
        videoId,
        userId,
        type: nextType,
        createdAt: serverTimestamp(),
      });
      await updateDoc(videoRef, {
        [nextType === 'like' ? 'likesCount' : 'dislikesCount']: increment(1),
        updatedAt: serverTimestamp(),
      });
      if (nextType === 'like' && notifyContext && notifyContext.creatorId !== userId) {
        await sendUserNotification({
          recipientId: notifyContext.creatorId,
          senderName: notifyContext.actorName,
          type: 'like',
          title: `${notifyContext.actorName} liked your video`,
          message: notifyContext.videoTitle,
          linkPath: `/watch/${videoId}`,
        });
      }
      return nextType;
    }

    await updateDoc(reactRef, { type: nextType });
    await updateDoc(videoRef, {
      likesCount: increment(nextType === 'like' ? 1 : -1),
      dislikesCount: increment(nextType === 'dislike' ? 1 : -1),
      updatedAt: serverTimestamp(),
    });
    return nextType;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `videos/${videoId}/reactions/${userId}`);
  }
}

export async function addVideoComment(
  videoId: string,
  author: UserPublicProfile,
  text: string,
  parentCommentId = '',
  notifyContext?: { creatorId: string; videoTitle: string }
) {
  const commentId = newDocId('cmt');
  try {
    await setDoc(doc(db, 'videos', videoId, 'comments', commentId), {
      videoId,
      authorId: author.uid,
      authorName: author.displayName.slice(0, VALIDATION_LIMITS.DISPLAY_NAME_MAX),
      authorAvatar: author.avatarUrl || '',
      text: text.trim().slice(0, VALIDATION_LIMITS.COMMENT_MAX),
      parentCommentId: parentCommentId.slice(0, 128),
      likesCount: 0,
      createdAt: serverTimestamp(),
    });
    await updateDoc(doc(db, 'videos', videoId), {
      commentsCount: increment(1),
      updatedAt: serverTimestamp(),
    });
    if (notifyContext && notifyContext.creatorId !== author.uid) {
      await sendUserNotification({
        recipientId: notifyContext.creatorId,
        senderName: author.displayName,
        type: 'comment',
        title: `New comment on ${notifyContext.videoTitle.slice(0, 48)}`,
        message: `${author.displayName}: ${text.trim().slice(0, 160)}`,
        linkPath: `/watch/${videoId}`,
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `videos/${videoId}/comments/${commentId}`);
  }
}

export async function toggleSubscribe(
  subscriber: UserPublicProfile,
  creator: { uid: string; displayName: string; avatarUrl?: string },
  currentlySubscribed: boolean
) {
  const subId = `${subscriber.uid}_${creator.uid}`;
  const subRef = doc(db, 'subscriptions', subId);
  const creatorRef = doc(db, 'users', creator.uid);
  try {
    if (currentlySubscribed) {
      await deleteDoc(subRef);
      const snap = await getDoc(creatorRef);
      if (snap.exists()) {
        await updateDoc(creatorRef, {
          subscribersCount: increment(-1),
          updatedAt: serverTimestamp(),
        });
      }
      return false;
    } else {
      await setDoc(subRef, {
        subscriberId: subscriber.uid,
        creatorId: creator.uid,
        creatorName: creator.displayName.slice(0, VALIDATION_LIMITS.DISPLAY_NAME_MAX),
        creatorAvatar: creator.avatarUrl || '',
        createdAt: serverTimestamp(),
      });
      const snap = await getDoc(creatorRef);
      if (snap.exists()) {
        await updateDoc(creatorRef, {
          subscribersCount: increment(1),
          updatedAt: serverTimestamp(),
        });
      }
      if (creator.uid !== subscriber.uid) {
        await sendUserNotification({
          recipientId: creator.uid,
          senderName: subscriber.displayName,
          type: 'subscriber',
          title: 'New Subscriber!',
          message: `${subscriber.displayName} subscribed to your channel.`,
          linkPath: `/channel/${subscriber.uid}`,
        });
      }
      return true;
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `subscriptions/${subId}`);
  }
}

export async function toggleWatchLater(
  userId: string,
  video: VideoItem,
  currentlySaved: boolean
): Promise<boolean> {
  const ref = doc(db, 'users', userId, 'watchLater', video.id);
  try {
    if (currentlySaved) {
      await deleteDoc(ref);
      return false;
    } else {
      await setDoc(ref, {
        userId,
        videoId: video.id,
        title: video.title.slice(0, VALIDATION_LIMITS.VIDEO_TITLE_MAX),
        thumbnailUrl: video.thumbnailUrl || '',
        creatorId: video.creatorId,
        creatorName: video.creatorName.slice(0, VALIDATION_LIMITS.DISPLAY_NAME_MAX),
        durationSeconds: video.durationSeconds || 8,
        type: video.type,
        createdAt: serverTimestamp(),
      });
      return true;
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${userId}/watchLater/${video.id}`);
  }
}

export async function createPlaylist(
  owner: UserPublicProfile,
  title: string,
  description: string,
  visibility: 'public' | 'private',
  initialVideoId?: string,
  thumbnailUrl?: string
): Promise<string> {
  const playlistId = newDocId('pl');
  try {
    await setDoc(doc(db, 'playlists', playlistId), {
      ownerId: owner.uid,
      ownerName: owner.displayName.slice(0, VALIDATION_LIMITS.DISPLAY_NAME_MAX),
      title: title.trim().slice(0, VALIDATION_LIMITS.PLAYLIST_TITLE_MAX),
      description: description.trim().slice(0, VALIDATION_LIMITS.PLAYLIST_DESC_MAX),
      visibility,
      videoIds: initialVideoId ? [initialVideoId] : [],
      thumbnailUrl: thumbnailUrl || '/src/assets/images/thumb_tech_india_1794912701310.jpg',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return playlistId;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `playlists/${playlistId}`);
  }
}

export async function toggleVideoInPlaylist(playlist: Playlist, videoId: string, thumbnailUrl?: string) {
  const exists = playlist.videoIds.includes(videoId);
  const ref = doc(db, 'playlists', playlist.id);
  try {
    if (exists) {
      await updateDoc(ref, {
        videoIds: arrayRemove(videoId),
        updatedAt: serverTimestamp(),
      });
      return false;
    } else {
      if (playlist.videoIds.length >= VALIDATION_LIMITS.PLAYLIST_VIDEOS_MAX) {
        throw new Error(`Playlist limit reached (${VALIDATION_LIMITS.PLAYLIST_VIDEOS_MAX} videos max).`);
      }
      await updateDoc(ref, {
        videoIds: arrayUnion(videoId),
        ...(thumbnailUrl ? { thumbnailUrl } : {}),
        updatedAt: serverTimestamp(),
      });
      return true;
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `playlists/${playlist.id}`);
  }
}

export async function saveWatchProgress(
  userId: string,
  video: VideoItem,
  progressSeconds: number,
  prevMaxProgress = 0
) {
  const ref = doc(db, 'users', userId, 'watchHistory', video.id);
  const rounded = Math.max(0, Math.round(progressSeconds));
  const nextMax = Math.max(prevMaxProgress, rounded);
  try {
    await setDoc(
      ref,
      {
        userId,
        videoId: video.id,
        title: video.title.slice(0, VALIDATION_LIMITS.VIDEO_TITLE_MAX),
        thumbnailUrl: video.thumbnailUrl || '',
        creatorName: video.creatorName.slice(0, VALIDATION_LIMITS.DISPLAY_NAME_MAX),
        durationSeconds: video.durationSeconds || 8,
        progressSeconds: rounded,
        maxProgressSeconds: nextMax,
        updatedAt: serverTimestamp(),
      },
      { merge: false }
    );
    if (rounded > prevMaxProgress) {
      await updateDoc(doc(db, 'videos', video.id), {
        totalWatchSeconds: increment(Math.min(10, rounded - prevMaxProgress)),
        updatedAt: serverTimestamp(),
      }).catch(() => {});
    }
  } catch {
    // non-fatal progress sync
  }
}

export async function removeWatchHistoryItem(userId: string, videoId: string) {
  try {
    await deleteDoc(doc(db, 'users', userId, 'watchHistory', videoId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `users/${userId}/watchHistory/${videoId}`);
  }
}

// --- Community Posts, Creator Support & Live Streaming ---
export async function createCommunityPost(params: {
  creator: UserPublicProfile;
  content: string;
  postType: 'text' | 'image' | 'poll' | 'announcement';
  imageUrl?: string;
  pollOptions?: string[];
}) {
  const postId = newDocId('post');
  const opts = (params.pollOptions || []).map((o) => o.trim()).filter(Boolean).slice(0, 4);
  try {
    await setDoc(doc(db, 'communityPosts', postId), {
      creatorId: params.creator.uid,
      creatorName: params.creator.displayName.slice(0, VALIDATION_LIMITS.DISPLAY_NAME_MAX),
      creatorAvatar: params.creator.avatarUrl || '',
      content: params.content.trim().slice(0, VALIDATION_LIMITS.COMMUNITY_POST_MAX),
      imageUrl: (params.imageUrl || '').slice(0, 500),
      postType: params.postType,
      pollOptions: opts,
      pollVotes: opts.map(() => 0),
      likesCount: 0,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `communityPosts/${postId}`);
  }
}

export async function voteCommunityPoll(post: CommunityPost, optionIndex: number) {
  const votes = [...(post.pollVotes || [])];
  if (optionIndex < 0 || optionIndex >= (post.pollOptions?.length || 0)) return;
  votes[optionIndex] = (votes[optionIndex] || 0) + 1;
  try {
    await updateDoc(doc(db, 'communityPosts', post.id), {
      pollVotes: votes,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `communityPosts/${post.id}`);
  }
}

export async function sendCreatorSupport(params: {
  supporter: UserPublicProfile;
  creatorId: string;
  creatorName: string;
  amountInr: number;
  message: string;
}) {
  const supportId = newDocId('sup');
  try {
    await setDoc(doc(db, 'creatorSupports', supportId), {
      supporterId: params.supporter.uid,
      supporterName: params.supporter.displayName.slice(0, VALIDATION_LIMITS.DISPLAY_NAME_MAX),
      creatorId: params.creatorId,
      creatorName: params.creatorName.slice(0, VALIDATION_LIMITS.DISPLAY_NAME_MAX),
      amountInr: Math.max(10, Math.min(50000, params.amountInr)),
      message: params.message.trim().slice(0, VALIDATION_LIMITS.SUPPORT_MSG_MAX),
      createdAt: serverTimestamp(),
    });
    await sendUserNotification({
      recipientId: params.creatorId,
      senderName: params.supporter.displayName,
      type: 'support',
      title: `Received ₹${params.amountInr} Creator Support`,
      message: params.message.trim() || `${params.supporter.displayName} supported your channel!`,
      linkPath: '/studio',
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `creatorSupports/${supportId}`);
  }
}

export async function startLiveStream(
  creator: UserPublicProfile,
  params: { title: string; description: string; category: string; language: string; thumbnailUrl: string }
): Promise<LiveStream> {
  const streamId = newDocId('live');
  const docPayload = {
    creatorId: creator.uid,
    creatorName: creator.displayName.slice(0, VALIDATION_LIMITS.DISPLAY_NAME_MAX),
    creatorAvatar: creator.avatarUrl || '',
    title: params.title.trim().slice(0, VALIDATION_LIMITS.VIDEO_TITLE_MAX),
    description: params.description.trim().slice(0, 1000),
    category: params.category,
    language: params.language,
    thumbnailUrl: params.thumbnailUrl || '/src/assets/images/thumb_tech_india_1794912701310.jpg',
    streamUrl: '/api/media/videos/tech_india_demo.mp4',
    isLive: true,
    viewerCount: 1,
    startedAt: serverTimestamp(),
  };
  try {
    await setDoc(doc(db, 'liveStreams', streamId), docPayload);
    return {
      id: streamId,
      ...docPayload,
      startedAt: new Date(),
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `liveStreams/${streamId}`);
  }
}

export async function endLiveStream(streamId: string) {
  try {
    await updateDoc(doc(db, 'liveStreams', streamId), {
      isLive: false,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `liveStreams/${streamId}`);
  }
}

export async function sendLiveChatMessage(
  streamId: string,
  sender: UserPublicProfile,
  text: string,
  superSupportInr = 0
): Promise<LiveChatMessage> {
  const messageId = newDocId('lmsg');
  const payload = {
    streamId,
    senderId: sender.uid,
    senderName: sender.displayName.slice(0, VALIDATION_LIMITS.DISPLAY_NAME_MAX),
    senderAvatar: sender.avatarUrl || '',
    text: text.trim().slice(0, VALIDATION_LIMITS.CHAT_MSG_MAX),
    superSupportInr,
    createdAt: serverTimestamp(),
  };
  try {
    await setDoc(doc(db, 'liveStreams', streamId, 'messages', messageId), payload);
    return { id: messageId, ...payload, createdAt: new Date() };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `liveStreams/${streamId}/messages/${messageId}`);
  }
}

export async function submitModerationReport(params: {
  reporterId: string;
  targetType: 'video' | 'comment' | 'user';
  targetId: string;
  targetTitle: string;
  reason: string;
}) {
  const reportId = newDocId('rep');
  try {
    await setDoc(doc(db, 'reports', reportId), {
      reporterId: params.reporterId,
      targetType: params.targetType,
      targetId: params.targetId,
      targetTitle: params.targetTitle.slice(0, 150),
      reason: params.reason.trim().slice(0, VALIDATION_LIMITS.REPORT_REASON_MAX),
      status: 'pending',
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `reports/${reportId}`);
  }
}

export async function markNotificationRead(notificationId: string) {
  try {
    await updateDoc(doc(db, 'notifications', notificationId), { isRead: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `notifications/${notificationId}`);
  }
}

export async function markAllNotificationsRead(notifications: UserNotification[]) {
  const unread = notifications.filter((n) => !n.isRead);
  await Promise.all(
    unread.map((n) => updateDoc(doc(db, 'notifications', n.id), { isRead: true }).catch(() => {}))
  );
}

// --- Admin Controls ---
export async function adminUpdateVideoStatus(
  videoId: string,
  status: 'published' | 'flagged' | 'removed',
  isTrending?: boolean,
  isOriginal?: boolean
) {
  try {
    await updateDoc(doc(db, 'videos', videoId), {
      status,
      ...(typeof isTrending === 'boolean' ? { isTrending } : {}),
      ...(typeof isOriginal === 'boolean' ? { isOriginal } : {}),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `videos/${videoId}`);
  }
}

export async function adminUpdateCreatorFlags(
  uid: string,
  updates: {
    isFeatured?: boolean;
    isVerified?: boolean;
    boostEnabled?: boolean;
    leagueCategory?: string;
    rewardTier?: 'Seed' | 'Rising' | 'Star' | 'Icon';
  }
) {
  try {
    await updateDoc(doc(db, 'users', uid), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
  }
}

export async function adminResolveReport(reportId: string, status: 'reviewed' | 'resolved' | 'dismissed') {
  try {
    await updateDoc(doc(db, 'reports', reportId), { status });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `reports/${reportId}`);
  }
}

export async function adminSavePlatformConfig(config: Omit<PlatformConfig, 'updatedAt'>) {
  try {
    await setDoc(doc(db, 'platformConfig', 'settings'), {
      ...config,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'platformConfig/settings');
  }
}

export async function adminCreateChallenge(params: {
  title: string;
  description: string;
  prizePoolInr: number;
  category: string;
  deadline: string;
}) {
  const challengeId = newDocId('chg');
  try {
    await setDoc(doc(db, 'challenges', challengeId), {
      title: params.title.trim().slice(0, 120),
      description: params.description.trim().slice(0, 1000),
      prizePoolInr: Math.max(0, Number(params.prizePoolInr || 0)),
      category: params.category,
      deadline: params.deadline,
      participantsCount: 0,
      status: 'active',
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `challenges/${challengeId}`);
  }
}

export async function adminCreateCompetition(params: {
  title: string;
  monthLabel: string;
  description: string;
  prizePoolInr: number;
  categories?: string[];
}) {
  const compId = newDocId('comp');
  try {
    await setDoc(doc(db, 'competitions', compId), {
      title: params.title.trim().slice(0, 120),
      monthLabel: params.monthLabel.trim().slice(0, 40),
      description: params.description.trim().slice(0, 1000),
      prizePoolInr: Math.max(0, Number(params.prizePoolInr || 0)),
      categories: params.categories?.length
        ? params.categories
        : ['Best Educational Creator', 'Best Entertainment Creator', 'Rising Star'],
      winnerCreatorId: '',
      winnerCreatorName: '',
      status: 'active',
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `competitions/${compId}`);
  }
}

export async function adminUpdateCompetition(
  compId: string,
  updates: { status?: 'active' | 'completed'; winnerCreatorId?: string; winnerCreatorName?: string }
) {
  try {
    await updateDoc(doc(db, 'competitions', compId), updates);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `competitions/${compId}`);
  }
}

export async function adminCreateAnnouncement(params: {
  title: string;
  body: string;
  category: 'feature' | 'league' | 'policy' | 'event';
  createdBy: string;
}) {
  const annId = newDocId('ann');
  try {
    await setDoc(doc(db, 'announcements', annId), {
      title: params.title.trim().slice(0, 120),
      body: params.body.trim().slice(0, 600),
      category: params.category,
      createdBy: params.createdBy.slice(0, 80),
      isActive: true,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `announcements/${annId}`);
  }
}

export async function adminToggleAnnouncement(annId: string, isActive: boolean) {
  try {
    await updateDoc(doc(db, 'announcements', annId), { isActive });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `announcements/${annId}`);
  }
}
