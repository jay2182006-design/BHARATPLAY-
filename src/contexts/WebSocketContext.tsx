import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import type {
  LiveChatMessage,
  LiveStream,
  WatchPartyMessage,
  WatchPartySyncPayload,
} from '../types/bharatplay';

interface WebSocketContextValue {
  connected: boolean;
  liveViewerCounts: Record<string, number>;
  partyParticipantCounts: Record<string, number>;
  recentStreamAlerts: LiveStream[];
  joinStream: (streamId: string) => void;
  leaveStream: () => void;
  sendChatBroadcast: (streamId: string, payload: Omit<LiveChatMessage, 'createdAt'> & { createdAtIso: string }) => void;
  broadcastLiveStarted: (stream: LiveStream) => void;
  subscribeStreamChat: (streamId: string, cb: (msg: LiveChatMessage) => void) => () => void;
  joinParty: (partyId: string) => void;
  leaveParty: () => void;
  sendPartySync: (partyId: string, payload: Omit<WatchPartySyncPayload, 'partyId'>) => void;
  sendPartyChatBroadcast: (partyId: string, payload: Omit<WatchPartyMessage, 'createdAt'> & { createdAtIso: string }) => void;
  subscribePartySync: (partyId: string, cb: (payload: WatchPartySyncPayload) => void) => () => void;
  subscribePartyChat: (partyId: string, cb: (msg: WatchPartyMessage) => void) => () => void;
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const currentStreamRef = useRef<string | null>(null);
  const currentPartyRef = useRef<string | null>(null);
  const chatListenersRef = useRef<Map<string, Set<(msg: LiveChatMessage) => void>>>(new Map());
  const partySyncListenersRef = useRef<Map<string, Set<(payload: WatchPartySyncPayload) => void>>>(new Map());
  const partyChatListenersRef = useRef<Map<string, Set<(msg: WatchPartyMessage) => void>>>(new Map());

  const [connected, setConnected] = useState(false);
  const [liveViewerCounts, setLiveViewerCounts] = useState<Record<string, number>>({});
  const [partyParticipantCounts, setPartyParticipantCounts] = useState<Record<string, number>>({});
  const [recentStreamAlerts, setRecentStreamAlerts] = useState<LiveStream[]>([]);

  useEffect(() => {
    let active = true;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (!active) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!active) return;
        setConnected(true);
        if (user?.uid) {
          ws.send(JSON.stringify({ type: 'identify', uid: user.uid }));
        }
        if (currentStreamRef.current) {
          ws.send(JSON.stringify({ type: 'join_stream', streamId: currentStreamRef.current }));
        }
        if (currentPartyRef.current) {
          ws.send(JSON.stringify({ type: 'join_party', partyId: currentPartyRef.current }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'viewer_count' && data.streamId) {
            setLiveViewerCounts((prev) => ({ ...prev, [data.streamId]: Number(data.count || 0) }));
          } else if (data.type === 'chat_message' && data.streamId && data.payload) {
            const listeners = chatListenersRef.current.get(data.streamId);
            if (listeners) listeners.forEach((cb) => cb(data.payload));
          } else if (data.type === 'live_started' && data.stream) {
            setRecentStreamAlerts((prev) => [data.stream, ...prev.slice(0, 4)]);
          } else if (data.type === 'party_participants' && data.partyId) {
            setPartyParticipantCounts((prev) => ({ ...prev, [data.partyId]: Number(data.count || 0) }));
          } else if (data.type === 'party_sync' && data.partyId) {
            const listeners = partySyncListenersRef.current.get(data.partyId);
            if (listeners) listeners.forEach((cb) => cb(data));
          } else if (data.type === 'party_chat' && data.partyId && data.payload) {
            const listeners = partyChatListenersRef.current.get(data.partyId);
            if (listeners) listeners.forEach((cb) => cb(data.payload));
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        setConnected(false);
        if (active) {
          reconnectTimer = setTimeout(connect, 2500);
        }
      };
    };

    connect();

    return () => {
      active = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, [user?.uid]);

  const joinStream = (streamId: string) => {
    currentStreamRef.current = streamId;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'join_stream', streamId }));
    }
  };

  const leaveStream = () => {
    currentStreamRef.current = null;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'leave_stream' }));
    }
  };

  const sendChatBroadcast = (
    streamId: string,
    payload: Omit<LiveChatMessage, 'createdAt'> & { createdAtIso: string }
  ) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'chat_message', streamId, payload }));
    }
  };

  const broadcastLiveStarted = (stream: LiveStream) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'live_started', stream }));
    }
  };

  const subscribeStreamChat = (streamId: string, cb: (msg: LiveChatMessage) => void) => {
    let set = chatListenersRef.current.get(streamId);
    if (!set) {
      set = new Set();
      chatListenersRef.current.set(streamId, set);
    }
    set.add(cb);
    return () => {
      set?.delete(cb);
    };
  };

  const joinParty = (partyId: string) => {
    currentPartyRef.current = partyId;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'join_party', partyId }));
    }
  };

  const leaveParty = () => {
    currentPartyRef.current = null;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'leave_party' }));
    }
  };

  const sendPartySync = (partyId: string, payload: Omit<WatchPartySyncPayload, 'partyId'>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'party_sync', partyId, ...payload }));
    }
  };

  const sendPartyChatBroadcast = (
    partyId: string,
    payload: Omit<WatchPartyMessage, 'createdAt'> & { createdAtIso: string }
  ) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'party_chat', partyId, payload }));
    }
  };

  const subscribePartySync = (partyId: string, cb: (payload: WatchPartySyncPayload) => void) => {
    let set = partySyncListenersRef.current.get(partyId);
    if (!set) {
      set = new Set();
      partySyncListenersRef.current.set(partyId, set);
    }
    set.add(cb);
    return () => {
      set?.delete(cb);
    };
  };

  const subscribePartyChat = (partyId: string, cb: (msg: WatchPartyMessage) => void) => {
    let set = partyChatListenersRef.current.get(partyId);
    if (!set) {
      set = new Set();
      partyChatListenersRef.current.set(partyId, set);
    }
    set.add(cb);
    return () => {
      set?.delete(cb);
    };
  };

  return (
    <WebSocketContext.Provider
      value={{
        connected,
        liveViewerCounts,
        partyParticipantCounts,
        recentStreamAlerts,
        joinStream,
        leaveStream,
        sendChatBroadcast,
        broadcastLiveStarted,
        subscribeStreamChat,
        joinParty,
        leaveParty,
        sendPartySync,
        sendPartyChatBroadcast,
        subscribePartySync,
        subscribePartyChat,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const ctx = useContext(WebSocketContext);
  if (!ctx) throw new Error('useWebSocket must be used inside WebSocketProvider');
  return ctx;
}
