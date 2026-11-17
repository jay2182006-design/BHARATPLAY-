import React, { useEffect, useState } from 'react';
import { Radio, Send, Users, HeartHandshake, Smile } from 'lucide-react';
import { VideoPlayer } from '../components/VideoPlayer';
import { MediaImage } from '../components/MediaImage';
import { useAuth } from '../contexts/AuthContext';
import { useWebSocket } from '../contexts/WebSocketContext';
import { useToast } from '../components/Toast';
import {
  sendLiveChatMessage,
  subscribeLiveChat,
  toggleSubscribe,
} from '../lib/bharatplayService';
import { formatCount } from '../lib/formatters';
import type { AppRoute, LiveChatMessage, LiveStream, Subscription } from '../types/bharatplay';

const LIVE_EMOJIS = [
  '🔥', '👏', '❤️', '🙌', '🙏', '🇮🇳',
  '🎉', '😂', '😮', '💯', '🤩', '🎶',
  '🚀', '✨', '👍', '🧡', '💬', '⚡',
];

interface LivePageProps {
  streams: LiveStream[];
  selectedStreamId?: string;
  subscriptions: Subscription[];
  onSelectStream: (id: string) => void;
  onOpenChannel: (creatorId: string) => void;
  onNavigate: (route: AppRoute) => void;
}

export function LivePage({
  streams,
  selectedStreamId,
  subscriptions,
  onSelectStream,
  onOpenChannel,
  onNavigate,
}: LivePageProps) {
  const { user, profile } = useAuth();
  const { liveViewerCounts, joinStream, leaveStream, sendChatBroadcast, subscribeStreamChat } = useWebSocket();
  const { showToast } = useToast();

  const activeStream =
    streams.find((s) => s.id === selectedStreamId) ||
    streams.find((s) => s.isLive) ||
    streams[0] ||
    null;

  const [chatMessages, setChatMessages] = useState<LiveChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [superAmount, setSuperAmount] = useState(0);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  useEffect(() => {
    if (!activeStream) return;
    joinStream(activeStream.id);

    const unsubFirestore = subscribeLiveChat(activeStream.id, (msgs) => {
      setChatMessages(msgs);
    });

    const unsubWs = subscribeStreamChat(activeStream.id, (incoming) => {
      setChatMessages((prev) => {
        if (prev.some((m) => m.id === incoming.id)) return prev;
        return [...prev, incoming];
      });
    });

    return () => {
      leaveStream();
      unsubFirestore();
      unsubWs();
    };
  }, [activeStream?.id]);

  if (!activeStream) {
    return (
      <div className="max-w-4xl mx-auto p-12 text-center space-y-4">
        <Radio className="w-10 h-10 text-[#E11D48] mx-auto" />
        <h1 className="text-xl font-bold text-zinc-900 font-display">No Live Broadcasts Active</h1>
        <p className="text-sm text-zinc-600">
          Creators can start a live broadcast anytime from Creator Studio.
        </p>
        <button
          type="button"
          onClick={() => onNavigate('studio')}
          className="px-5 py-2.5 rounded-xl bg-[#E11D48] text-sm font-semibold text-white"
        >
          Open Creator Live Studio
        </button>
      </div>
    );
  }

  const wsViewers = liveViewerCounts[activeStream.id] || 0;
  const totalViewers = (activeStream.viewerCount || 0) + wsViewers;
  const isSubscribed = subscriptions.some((s) => s.creatorId === activeStream.creatorId);

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) {
      showToast('Please sign in to chat in live streams.', 'info');
      onNavigate('login');
      return;
    }
    if (!chatInput.trim()) return;
    try {
      const saved = await sendLiveChatMessage(activeStream.id, profile, chatInput, superAmount);
      sendChatBroadcast(activeStream.id, {
        ...saved,
        createdAtIso: new Date().toISOString(),
      });
      setChatInput('');
      setSuperAmount(0);
      setShowEmojiPicker(false);
    } catch {
      showToast('Could not send live chat message.', 'error');
    }
  };

  return (
    <div className="max-w-[1440px] mx-auto px-4 md:px-6 lg:px-8 py-5 space-y-6">
      {/* Live Stream Switcher */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {streams.map((st) => (
            <button
              key={st.id}
              type="button"
              onClick={() => onSelectStream(st.id)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 border transition-colors ${
                st.id === activeStream.id
                  ? 'bg-rose-50 border-[#E11D48] text-[#BE123C]'
                  : 'bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-zinc-100'
              }`}
            >
              {st.isLive && <span className="w-2 h-2 rounded-full bg-[#E11D48] animate-pulse" />}
              <span className="truncate max-w-[200px]">{st.creatorName}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => onNavigate('studio')}
          className="px-4 py-2 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-xs font-semibold text-white whitespace-nowrap"
        >
          Go Live in Studio
        </button>
      </div>

      {/* Main Live Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 space-y-4">
          <VideoPlayer
            src={activeStream.streamUrl || '/api/media/videos/tech_india_demo.mp4'}
            poster={activeStream.thumbnailUrl}
            title={activeStream.title}
            isLive={activeStream.isLive}
          />

          <div className="p-5 rounded-xl bg-zinc-50 border border-zinc-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold font-display text-zinc-900">{activeStream.title}</h1>
                <div className="mt-1 flex items-center gap-2 text-xs text-zinc-600">
                  <span className="inline-flex items-center gap-1 text-[#E11D48] font-semibold">
                    <Users className="w-3.5 h-3.5" />
                    <span className="tabular-nums">{formatCount(totalViewers)} watching now</span>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{activeStream.category || 'Live'}</span>
                  <span aria-hidden="true">·</span>
                  <span>{activeStream.language || 'Hindi'}</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => onOpenChannel(activeStream.creatorId)}
                  className="flex items-center gap-2.5 text-left"
                >
                  <MediaImage
                    src={activeStream.creatorAvatar}
                    alt={activeStream.creatorName}
                    className="w-9 h-9 rounded-full object-cover border border-zinc-200"
                  />
                  <span className="text-sm font-semibold text-zinc-900 hover:text-[#EA580C]">
                    {activeStream.creatorName}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!user || !profile) return onNavigate('login');
                    const next = await toggleSubscribe(
                      profile,
                      {
                        uid: activeStream.creatorId,
                        displayName: activeStream.creatorName,
                        avatarUrl: activeStream.creatorAvatar,
                      },
                      isSubscribed
                    );
                    showToast(next ? 'Subscribed!' : 'Unsubscribed', 'success');
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold ${
                    isSubscribed ? 'bg-zinc-200 text-zinc-900 border border-zinc-300' : 'bg-[#E11D48] text-white'
                  }`}
                >
                  {isSubscribed ? 'Subscribed' : 'Subscribe'}
                </button>
              </div>
            </div>

            {activeStream.description && (
              <p className="text-sm text-zinc-700 leading-relaxed pt-2 border-t border-zinc-200">
                {activeStream.description}
              </p>
            )}
          </div>
        </div>

        {/* Real-Time Live Chat Panel with Native Emoji Picker */}
        <aside className="lg:col-span-4 bg-white border border-zinc-200 rounded-xl flex flex-col h-[540px] overflow-hidden shadow-sm relative">
          <div className="px-4 py-3 border-b border-zinc-200 flex items-center justify-between bg-zinc-50">
            <span className="text-sm font-bold text-zinc-900">Live Chat</span>
            <span className="text-xs text-zinc-500 tabular-nums">{chatMessages.length} messages</span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white">
            {chatMessages.length === 0 ? (
              <div className="text-xs text-zinc-500 text-center py-10">
                Welcome to the live chat! Say namaste to {activeStream.creatorName}.
              </div>
            ) : (
              chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`text-xs rounded-lg p-2 ${
                    msg.superSupportInr && msg.superSupportInr > 0
                      ? 'bg-orange-50 border border-orange-200'
                      : 'bg-zinc-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-zinc-900">{msg.senderName}</span>
                    {msg.superSupportInr && msg.superSupportInr > 0 ? (
                      <span className="text-[#EA580C] font-mono font-bold">
                        ₹{msg.superSupportInr} Support
                      </span>
                    ) : null}
                  </div>
                  <p className="text-zinc-700 mt-0.5 break-words">{msg.text}</p>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleSendChat} className="p-3 border-t border-zinc-200 space-y-2 bg-zinc-50 relative">
            {showEmojiPicker && (
              <div className="absolute bottom-24 left-3 right-3 p-2.5 rounded-xl bg-white border border-zinc-200 shadow-2xl grid grid-cols-6 gap-1.5 z-20">
                {LIVE_EMOJIS.map((em) => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => {
                      setChatInput((prev) => `${prev}${em}`);
                      setShowEmojiPicker(false);
                    }}
                    className="p-1.5 rounded-lg hover:bg-zinc-100 text-base text-center transition-colors"
                  >
                    {em}
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center gap-1.5">
              <HeartHandshake className="w-3.5 h-3.5 text-[#EA580C] shrink-0" />
              <span className="text-[11px] text-zinc-600">Super Chat:</span>
              {[0, 50, 100, 500].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setSuperAmount(amt)}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono ${
                    superAmount === amt
                      ? 'bg-[#F97316] text-white'
                      : 'bg-white border border-zinc-300 text-zinc-700 hover:bg-zinc-100'
                  }`}
                >
                  {amt === 0 ? 'Off' : `₹${amt}`}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowEmojiPicker((s) => !s)}
                aria-label="Open emoji picker"
                className={`px-2.5 py-2 rounded-xl border transition-colors ${
                  showEmojiPicker
                    ? 'bg-orange-50 border-[#F97316] text-[#EA580C]'
                    : 'bg-white border-zinc-300 text-zinc-600 hover:text-zinc-900'
                }`}
              >
                <Smile className="w-4 h-4" />
              </button>
              <input
                type="text"
                maxLength={400}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={user ? 'Chat live...' : 'Sign in to chat'}
                className="flex-1 px-3 py-2 rounded-xl bg-white border border-zinc-300 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-[#E11D48]"
              />
              <button
                type="submit"
                aria-label="Send live chat message"
                className="px-3.5 py-2 rounded-xl bg-[#E11D48] hover:bg-[#BE123C] text-white"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
        </aside>
      </div>
    </div>
  );
}
