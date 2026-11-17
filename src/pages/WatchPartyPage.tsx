import React, { useEffect, useState } from 'react';
import {
  Copy,
  Lock,
  Plus,
  Send,
  Tv,
  Users,
  Globe2,
  LogIn,
} from 'lucide-react';
import { VideoPlayer, type ExternalPlaybackSync } from '../components/VideoPlayer';
import { MediaImage } from '../components/MediaImage';
import { useAuth } from '../contexts/AuthContext';
import { useWebSocket } from '../contexts/WebSocketContext';
import { useToast } from '../components/Toast';
import {
  createWatchParty,
  getWatchPartyById,
  sendWatchPartyMessage,
  subscribeWatchPartyMessages,
  subscribeWatchPartyRoom,
  updateWatchPartyState,
} from '../lib/bharatplayService';
import type {
  AppRoute,
  VideoItem,
  WatchPartyMessage,
  WatchPartyRoom,
} from '../types/bharatplay';

interface WatchPartyPageProps {
  videos: VideoItem[];
  watchParties: WatchPartyRoom[];
  initialRoomId?: string;
  onNavigate: (route: AppRoute, param?: string) => void;
}

export function WatchPartyPage({
  videos,
  watchParties,
  initialRoomId,
  onNavigate,
}: WatchPartyPageProps) {
  const { user, profile } = useAuth();
  const {
    partyParticipantCounts,
    joinParty,
    leaveParty,
    sendPartySync,
    sendPartyChatBroadcast,
    subscribePartySync,
    subscribePartyChat,
  } = useWebSocket();
  const { showToast } = useToast();

  const [activeRoomId, setActiveRoomId] = useState(initialRoomId || '');
  const [activeRoom, setActiveRoom] = useState<WatchPartyRoom | null>(null);
  const [messages, setMessages] = useState<WatchPartyMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [externalSync, setExternalSync] = useState<ExternalPlaybackSync | null>(null);

  // Join by Invite Code / Room ID
  const [joinCodeInput, setJoinCodeInput] = useState('');

  // Create Watch Party Modal
  const [showCreate, setShowCreate] = useState(false);
  const [roomTitle, setRoomTitle] = useState('');
  const [selectedVideoId, setSelectedVideoId] = useState(
    videos.find((v) => v.type === 'video')?.id || videos[0]?.id || ''
  );
  const [isPrivate, setIsPrivate] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (initialRoomId) setActiveRoomId(initialRoomId);
  }, [initialRoomId]);

  useEffect(() => {
    if (!selectedVideoId && videos.length > 0) {
      setSelectedVideoId(videos[0].id);
    }
  }, [videos, selectedVideoId]);

  useEffect(() => {
    if (!activeRoomId) {
      setActiveRoom(null);
      setMessages([]);
      return;
    }

    joinParty(activeRoomId);

    const unsubRoom = subscribeWatchPartyRoom(activeRoomId, (room) => {
      setActiveRoom(room);
    });
    const unsubMsgs = subscribeWatchPartyMessages(activeRoomId, setMessages);
    const unsubWsSync = subscribePartySync(activeRoomId, (payload) => {
      setExternalSync({
        isPlaying: payload.isPlaying,
        currentTime: payload.currentTime,
        seq: Date.now(),
      });
    });
    const unsubWsChat = subscribePartyChat(activeRoomId, (incoming) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === incoming.id)) return prev;
        return [...prev, incoming];
      });
    });

    return () => {
      leaveParty();
      unsubRoom();
      unsubMsgs();
      unsubWsSync();
      unsubWsChat();
    };
  }, [activeRoomId]);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) {
      showToast('Please sign in to host a Watch Party.', 'info');
      onNavigate('login');
      return;
    }
    const vid = videos.find((v) => v.id === selectedVideoId) || videos[0];
    if (!vid) {
      showToast('Select a video to watch together.', 'error');
      return;
    }
    setCreating(true);
    try {
      const room = await createWatchParty({
        host: profile,
        title: roomTitle.trim() || `${vid.title.slice(0, 50)} — Party`,
        video: vid,
        isPrivate,
      });
      setShowCreate(false);
      setRoomTitle('');
      setActiveRoomId(room.id);
      showToast(`Watch Party ready! Share code ${room.id}`, 'success');
    } catch {
      showToast('Could not create Watch Party room.', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = joinCodeInput.trim();
    if (!raw) return;
    const normalized = raw.startsWith('BP-') ? raw.replace('BP-', 'wp_') : raw;
    const room = await getWatchPartyById(normalized);
    if (!room) {
      showToast('No Watch Party found with that Room ID / Invite Code.', 'error');
      return;
    }
    setActiveRoomId(room.id);
    setJoinCodeInput('');
    showToast(`Joined ${room.title}`, 'success');
  };

  const handlePlaybackAction = (isPlaying: boolean, currentTime: number) => {
    if (!activeRoom) return;
    sendPartySync(activeRoom.id, {
      videoId: activeRoom.videoId,
      isPlaying,
      currentTime,
      actorName: profile?.displayName || 'Viewer',
    });
    updateWatchPartyState(activeRoom.id, {
      isPlaying,
      currentTimeSeconds: Math.round(currentTime),
    });
  };

  const handleSendRoomChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRoom) return;
    if (!user || !profile) {
      showToast('Please sign in to chat in the Watch Party.', 'info');
      onNavigate('login');
      return;
    }
    if (!chatInput.trim()) return;
    try {
      const saved = await sendWatchPartyMessage(activeRoom.id, profile, chatInput);
      sendPartyChatBroadcast(activeRoom.id, {
        ...saved,
        createdAtIso: new Date().toISOString(),
      });
      setChatInput('');
    } catch {
      showToast('Failed to send message.', 'error');
    }
  };

  const participantsCount = activeRoom ? Math.max(1, partyParticipantCounts[activeRoom.id] || 1) : 0;

  return (
    <div className="max-w-[1440px] mx-auto px-4 md:px-6 lg:px-8 py-6 space-y-8">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold font-display text-zinc-900 flex items-center gap-2.5">
            <Tv className="w-6 h-6 text-[#E11D48]" />
            <span>BharatPlay Watch Party</span>
          </h1>
          <p className="text-xs text-zinc-600 mt-1">
            Create private or public synchronized viewing rooms with real-time play/pause and live room chat.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <form onSubmit={handleJoinByCode} className="flex items-center gap-2">
            <input
              type="text"
              value={joinCodeInput}
              onChange={(e) => setJoinCodeInput(e.target.value)}
              placeholder="Enter Room ID (wp_...)"
              className="px-3 py-2 rounded-xl bg-white border border-zinc-300 text-xs text-zinc-900 placeholder-zinc-400 w-44"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 text-xs font-semibold text-zinc-900"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Join</span>
            </button>
          </form>

          <button
            type="button"
            onClick={() => (user ? setShowCreate(true) : onNavigate('login'))}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#E11D48] hover:bg-[#BE123C] text-xs font-semibold text-white"
          >
            <Plus className="w-4 h-4" />
            <span>Create Watch Room</span>
          </button>
        </div>
      </div>

      {/* Active Synchronized Room */}
      {activeRoom ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-8 space-y-4">
            <VideoPlayer
              src={activeRoom.videoUrl}
              poster={activeRoom.thumbnailUrl}
              title={activeRoom.videoTitle}
              initialTime={activeRoom.currentTimeSeconds || 0}
              externalSync={externalSync}
              onPlaybackAction={handlePlaybackAction}
            />

            <div className="p-5 rounded-2xl bg-zinc-50 border border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-200/70 text-[11px] font-medium text-zinc-800">
                    {activeRoom.isPrivate ? <Lock className="w-3 h-3 text-[#EA580C]" /> : <Globe2 className="w-3 h-3 text-emerald-600" />}
                    {activeRoom.isPrivate ? 'Private Room' : 'Public Room'}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs text-[#E11D48] font-semibold">
                    <Users className="w-3.5 h-3.5" />
                    {participantsCount} in room
                  </span>
                </div>
                <h2 className="text-lg font-bold text-zinc-900">{activeRoom.title}</h2>
                <p className="text-xs text-zinc-600">
                  Hosted by {activeRoom.hostName} · Playing: {activeRoom.videoTitle}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard?.writeText(activeRoom.id);
                    showToast(`Copied Room ID: ${activeRoom.id}`, 'success');
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-orange-50 hover:bg-orange-100 border border-orange-200 text-xs font-semibold text-[#EA580C]"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Invite: {activeRoom.id}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveRoomId('')}
                  className="px-3 py-2 rounded-xl bg-zinc-200/70 hover:bg-zinc-200 text-xs font-medium text-zinc-800"
                >
                  Leave
                </button>
              </div>
            </div>
          </div>

          {/* Room Chat */}
          <aside className="lg:col-span-4 bg-white border border-zinc-200 rounded-2xl flex flex-col h-[520px] overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between">
              <span className="text-sm font-bold text-zinc-900">Room Chat</span>
              <span className="text-xs text-zinc-500 tabular-nums">{messages.length} msgs</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white">
              {messages.length === 0 ? (
                <p className="text-xs text-zinc-500 text-center py-10">
                  Play/pause syncs across everyone in this room. Say hello to start chatting!
                </p>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className="text-xs space-y-0.5 bg-zinc-50 p-2.5 rounded-lg border border-zinc-100">
                    <span className="font-semibold text-[#EA580C]">{m.senderName}</span>
                    <p className="text-zinc-800 break-words">{m.text}</p>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleSendRoomChat} className="p-3 border-t border-zinc-200 bg-zinc-50 flex gap-2">
              <input
                type="text"
                maxLength={400}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={user ? 'Message friends in room...' : 'Sign in to chat'}
                className="flex-1 px-3 py-2 rounded-xl bg-white border border-zinc-300 text-xs text-zinc-900 placeholder-zinc-400"
              />
              <button
                type="submit"
                aria-label="Send room message"
                className="px-3.5 py-2 rounded-xl bg-[#E11D48] hover:bg-[#BE123C] text-white"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </aside>
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="text-base font-bold text-zinc-900">Active Watch Party Rooms</h2>
          {watchParties.length === 0 ? (
            <div className="p-12 rounded-2xl bg-zinc-50 border border-zinc-200 text-center space-y-3">
              <Tv className="w-10 h-10 text-[#EA580C] mx-auto" />
              <div className="text-base font-bold text-zinc-900">Start a Synchronized Watch Party</div>
              <p className="text-xs text-zinc-600 max-w-md mx-auto">
                Pick any video on BharatPlay, invite friends with a private room code, and control play, pause, and seek together.
              </p>
              <button
                type="button"
                onClick={() => (user ? setShowCreate(true) : onNavigate('login'))}
                className="px-5 py-2.5 rounded-xl bg-[#E11D48] text-xs font-semibold text-white"
              >
                Create First Watch Room
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {watchParties.map((room) => (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => setActiveRoomId(room.id)}
                  className="text-left rounded-xl bg-white hover:bg-zinc-50 border border-zinc-200 hover:border-[#E11D48]/50 overflow-hidden transition-colors shadow-sm"
                >
                  <div className="aspect-video relative">
                    <MediaImage src={room.thumbnailUrl} alt={room.videoTitle} className="w-full h-full object-cover" />
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/75 text-[11px] font-semibold text-white">
                      {room.isPrivate ? 'Private' : 'Public'}
                    </span>
                  </div>
                  <div className="p-4 space-y-1">
                    <div className="text-sm font-bold text-zinc-900 truncate">{room.title}</div>
                    <div className="text-xs text-zinc-500 truncate">
                      Hosted by {room.hostName} · Code: {room.id}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Watch Room Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateRoom}
            className="w-full max-w-md bg-white border border-zinc-200 rounded-2xl p-6 space-y-4 text-zinc-900 shadow-2xl"
          >
            <h3 className="text-base font-bold">Create Watch Party Room</h3>
            <div>
              <label className="block text-xs text-zinc-700 mb-1.5">Room Title</label>
              <input
                type="text"
                required
                value={roomTitle}
                onChange={(e) => setRoomTitle(e.target.value)}
                placeholder="Friday Night Documentary Hangout"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-zinc-300 text-xs text-zinc-900"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-700 mb-1.5">Select Video</label>
              <select
                value={selectedVideoId}
                onChange={(e) => setSelectedVideoId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-zinc-300 text-xs text-zinc-900"
              >
                {videos.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.title} ({v.language})
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-xs text-zinc-700 cursor-pointer">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="accent-[#E11D48]"
              />
              <span>Private Room (Invite via Room ID only)</span>
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-xs text-zinc-600 hover:text-zinc-900"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating}
                className="px-4 py-2 rounded-xl bg-[#E11D48] text-xs font-semibold text-white"
              >
                {creating ? 'Creating...' : 'Start Watch Party'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
